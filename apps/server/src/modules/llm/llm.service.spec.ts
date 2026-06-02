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
  follower: {
    findFirst: jest.fn(),
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

  // ── Claude 分支 ──────────────────────────────────────────────────

  describe('chat (Claude provider)', () => {
    it('should send x-api-key header and parse content[0].text for claude', async () => {
      mockPrisma.llmConfig.findUnique.mockResolvedValue({ ...baseConfig, provider: 'claude' });
      mockPrisma.llmUsageLog.count.mockResolvedValue(0);
      mockPrisma.llmUsageLog.create.mockResolvedValue({});
      mockedAxios.post.mockResolvedValue({
        data: {
          content: [{ text: 'reply from claude' }],
          usage: { input_tokens: 7, output_tokens: 11 },
        },
      });

      const r = await service.chat('t1', {
        scene: 'x',
        messages: [
          { role: 'system', content: 'be brief' },
          { role: 'user', content: 'hi' },
        ],
      });

      expect(r.content).toBe('reply from claude');
      expect(r.tokensIn).toBe(7);
      expect(r.tokensOut).toBe(11);

      const [url, body, opts] = mockedAxios.post.mock.calls[0]! as [string, { model: string; messages: unknown[]; system: string }, { headers: Record<string, string> }];
      expect(url).toBe('https://api.anthropic.com/v1/messages');
      expect(body.model).toBe('claude-sonnet-4-6');
      expect(body.system).toBe('be brief');
      // system message 应被剥离到顶层
      expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);
      expect(opts.headers['x-api-key']).toBe('sk-test');
      expect(opts.headers['anthropic-version']).toBe('2023-06-01');
    });
  });

  // ── 配置读写 ──────────────────────────────────────────────────────

  describe('getConfig / upsertConfig', () => {
    it('getConfig should mask apiKey to last 4 chars', async () => {
      mockPrisma.llmConfig.findUnique.mockResolvedValue({ ...baseConfig, apiKey: 'sk-abc12345XYZ' });
      const r = await service.getConfig('t1');
      expect(r.apiKey).toBe('****5XYZ');
    });

    it('getConfig should return null when no config', async () => {
      mockPrisma.llmConfig.findUnique.mockResolvedValue(null);
      expect(await service.getConfig('t-no')).toBeNull();
    });

    it('getConfig should return null apiKey when apiKey is null', async () => {
      mockPrisma.llmConfig.findUnique.mockResolvedValue({ ...baseConfig, apiKey: null });
      const r = await service.getConfig('t1');
      expect(r.apiKey).toBeNull();
    });

    it('upsertConfig should clean empty strings to null and apply defaults', async () => {
      mockPrisma.llmConfig.upsert.mockResolvedValue({});
      await service.upsertConfig('t1', {
        provider: '', apiKey: 'sk-x', apiUrl: '', model: '',
        temperature: undefined, maxTokens: 0, systemPrompt: '', dailyLimit: 0, status: '',
      });
      const call = mockPrisma.llmConfig.upsert.mock.calls[0][0];
      expect(call.create.tenantId).toBe('t1');
      expect(call.create.provider).toBe('openai');        // 默认
      expect(call.create.apiUrl).toBeNull();                // '' → null
      expect(call.create.model).toBeNull();
      expect(call.create.systemPrompt).toBeNull();
      expect(call.create.temperature).toBe(0.7);
      expect(call.create.maxTokens).toBe(4096);
      expect(call.create.dailyLimit).toBe(100);
      expect(call.create.status).toBe('active');
      expect(call.update.provider).toBe('openai');
      expect(call.update.apiKey).toBe('sk-x');
    });
  });

  // ── 自动回复 ──────────────────────────────────────────────────────

  describe('autoReply', () => {
    it('should return AI reply truncated to 200 chars', async () => {
      mockPrisma.follower.findFirst.mockResolvedValue(null);   // 默认 '用户'
      mockPrisma.llmConfig.findUnique.mockResolvedValue(baseConfig);
      mockPrisma.llmUsageLog.count.mockResolvedValue(0);
      mockPrisma.llmUsageLog.create.mockResolvedValue({});
      const long = 'a'.repeat(300);
      mockedAxios.post.mockResolvedValue({
        data: { choices: [{ message: { content: long } }], usage: { prompt_tokens: 1, completion_tokens: 1 } },
      });
      const r = await service.autoReply('t1', 'auth-1', 'hi');
      expect(r).toBe('a'.repeat(200));
    });

    it('should return fallback message when chat throws', async () => {
      mockPrisma.follower.findFirst.mockResolvedValue(null);
      mockPrisma.llmConfig.findUnique.mockResolvedValue(null);
      const r = await service.autoReply('t1', 'auth-1', 'hi');
      expect(r).toBe('感谢您的留言，我们会尽快回复您。');
    });
  });

  // ── 周报 ──────────────────────────────────────────────────────────

  describe('getUsageLogs', () => {
    it('should return empty when tenant has no config', async () => {
      mockPrisma.llmConfig.findUnique.mockResolvedValue(null);
      const r = await service.getUsageLogs('t-no', 1, 20);
      expect(r).toEqual({ list: [], total: 0 });
    });

    it('should paginate when config exists', async () => {
      mockPrisma.llmConfig.findUnique.mockResolvedValue(baseConfig);
      mockPrisma.llmUsageLog.findMany.mockResolvedValue([{ id: 'l1' }]);
      mockPrisma.llmUsageLog.count.mockResolvedValue(1);
      const r = await service.getUsageLogs('t1', 2, 5);
      expect(r.total).toBe(1);
      expect(r.page).toBe(2);
      expect(r.page_size).toBe(5);
      const w = mockPrisma.llmUsageLog.findMany.mock.calls[0][0];
      expect(w.skip).toBe(5);  // (2-1)*5
      expect(w.take).toBe(5);
    });
  });
});
