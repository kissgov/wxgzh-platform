// LlmService 单元测试 — OpenAI 兼容调用 / 限额 / 失败回写 / 用量日志
// ============================================================================
jest.mock('axios');

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import axios from 'axios';
import { LlmService } from './llm.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockedAxios = axios as jest.Mocked<typeof axios>;

const mockPrisma: any = {
  llmConfig: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  llmUsageLog: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

const baseConfig = {
  id: 'cfg-1',
  tenantId: 't1',
  provider: 'openai',
  apiKey: 'sk-test',
  apiUrl: null,
  model: null,
  temperature: 0.7,
  maxTokens: 4096,
  systemPrompt: null,
  dailyLimit: 100,
  status: 'active',
};

describe('LlmService', () => {
  let service: LlmService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<LlmService>(LlmService);
  });

  // ── chat 走 OpenAI 兼容接口 ──────────────────────────────────────

  describe('chat (OpenAI-compatible path)', () => {
    it('should POST to OpenAI default URL, parse content + usage, and log success', async () => {
      mockPrisma.llmConfig.findUnique.mockResolvedValue(baseConfig);
      mockPrisma.llmUsageLog.count.mockResolvedValue(0);
      mockPrisma.llmUsageLog.create.mockResolvedValue({});
      mockedAxios.post.mockResolvedValue({
        data: {
          choices: [{ message: { content: 'hi from openai' } }],
          usage: { prompt_tokens: 5, completion_tokens: 3 },
        },
      });

      const result = await service.chat('t1', {
        scene: 'agent_task',
        messages: [{ role: 'user', content: 'hello' }],
      });

      // 1. 返回值含 content / tokens / duration
      expect(result.content).toBe('hi from openai');
      expect(result.tokensIn).toBe(5);
      expect(result.tokensOut).toBe(3);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);

      // 2. axios.post 必传 OpenAI URL + Authorization: Bearer + body
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      const [url, body, opts] = mockedAxios.post.mock.calls[0]! as [string, { model: string; messages: unknown[] }, { headers: { Authorization: string }; timeout: number }];
      expect(url).toBe('https://api.openai.com/v1/chat/completions');
      expect(body.model).toBe('gpt-4o');
      expect(body.messages).toEqual([{ role: 'user', content: 'hello' }]);
      expect(opts.headers.Authorization).toBe('Bearer sk-test');
      expect(opts.timeout).toBe(60000);

      // 3. 用量日志写入, status=success
      const logCall = mockPrisma.llmUsageLog.create.mock.calls[0][0];
      expect(logCall.data.configId).toBe('cfg-1');
      expect(logCall.data.status).toBe('success');
      expect(logCall.data.tokensIn).toBe(5);
      expect(logCall.data.tokensOut).toBe(3);
    });
  });

  // ── chat 失败抛出 ───────────────────────────────────────────────

  describe('chat (failure path)', () => {
    it('should throw BadRequestException and write error log when upstream 500s', async () => {
      mockPrisma.llmConfig.findUnique.mockResolvedValue(baseConfig);
      mockPrisma.llmUsageLog.count.mockResolvedValue(0);
      mockPrisma.llmUsageLog.create.mockResolvedValue({});
      // 模拟上游 500
      mockedAxios.post.mockRejectedValue({
        response: { data: { error: { message: 'upstream rate limit' } } },
        message: 'Request failed',
      });

      await expect(
        service.chat('t1', { scene: 'test', messages: [{ role: 'user', content: 'q' }] }),
      ).rejects.toThrow(BadRequestException);

      // 错误日志: status=error, errorMsg 提取
      const logCall = mockPrisma.llmUsageLog.create.mock.calls[0][0];
      expect(logCall.data.status).toBe('error');
      expect(logCall.data.errorMsg).toBe('upstream rate limit');
    });

    it('should throw when tenant has no LLM config', async () => {
      mockPrisma.llmConfig.findUnique.mockResolvedValue(null);

      await expect(
        service.chat('t-no-cfg', { scene: 'x', messages: [] }),
      ).rejects.toThrow(BadRequestException);

      // 不应调外部 API
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });
  });

  // ── 用量统计 ────────────────────────────────────────────────────

  describe('getUsageStats (token usage aggregation)', () => {
    it('should return today + total + limit from llmConfig + llmUsageLog', async () => {
      mockPrisma.llmConfig.findUnique.mockResolvedValue(baseConfig);
      // today count = 3, total = 47
      mockPrisma.llmUsageLog.count
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(47);

      const result = await service.getUsageStats('t1');

      expect(result).toEqual({ today: 3, total: 47, limit: 100 });

      // 两次 count: 一次带 createdAt.gte=today, 一次无 createdAt
      const todayCall = mockPrisma.llmUsageLog.count.mock.calls[0][0];
      expect(todayCall.where.configId).toBe('cfg-1');
      expect(todayCall.where.createdAt.gte).toBeInstanceOf(Date);

      const totalCall = mockPrisma.llmUsageLog.count.mock.calls[1][0];
      expect(totalCall.where.createdAt).toBeUndefined();
    });

    it('should return zeros when tenant has no config', async () => {
      mockPrisma.llmConfig.findUnique.mockResolvedValue(null);

      const result = await service.getUsageStats('t-no-cfg');

      expect(result).toEqual({ today: 0, total: 0, limit: 0 });
      expect(mockPrisma.llmUsageLog.count).not.toHaveBeenCalled();
    });
  });

  // ── 每日限额 ────────────────────────────────────────────────────

  describe('chat (daily limit enforcement)', () => {
    it('should reject when today call count >= dailyLimit', async () => {
      mockPrisma.llmConfig.findUnique.mockResolvedValue(baseConfig);
      mockPrisma.llmUsageLog.count.mockResolvedValue(100); // 等于 dailyLimit

      await expect(
        service.chat('t1', { scene: 'x', messages: [{ role: 'user', content: 'q' }] }),
      ).rejects.toThrow(/每日调用上限/);

      // 不应调上游
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });
  });
});
