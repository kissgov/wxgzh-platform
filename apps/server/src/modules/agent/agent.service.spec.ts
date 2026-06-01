// AgentService 单元测试 — 内置 Skill 幂等 / Agent 关联 / Task 成功失败回写
// ============================================================================
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AgentService } from './agent.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';

const mockPrisma: any = {
  skill: {
    upsert: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  agent: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  agentSkill: {
    create: jest.fn(),
  },
  agentTask: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
};

const mockLlm: any = {
  chat: jest.fn(),
};

describe('AgentService', () => {
  let service: AgentService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LlmService, useValue: mockLlm },
      ],
    }).compile();
    service = module.get<AgentService>(AgentService);
  });

  // ── seedBuiltinSkills 幂等 ─────────────────────────────────────────

  describe('seedBuiltinSkills (idempotent)', () => {
    it('should upsert 8 builtin skills per tenant and be safe to call twice', async () => {
      // 每次 upsert 都成功(无论存在与否)
      mockPrisma.skill.upsert.mockResolvedValue({ id: 's1' });

      await service.seedBuiltinSkills('t1');
      await service.seedBuiltinSkills('t1'); // 第二次

      // 内置 8 个 skill, 每次调用都跑 8 次 upsert
      expect(mockPrisma.skill.upsert).toHaveBeenCalledTimes(16);

      // 第一次调用: 必传 tenantId + slug, 标记 isSystem=true
      const firstCall = mockPrisma.skill.upsert.mock.calls[0][0];
      expect(firstCall.where.tenantId_slug).toEqual({ tenantId: 't1', slug: 'content-writer' });
      expect(firstCall.create.isSystem).toBe(true);
      expect(firstCall.create.tenantId).toBe('t1');

      // 关键: update 分支(已存在)不会重置 isSystem, 只刷新 name/desc/prompt/category
      expect(firstCall.update.isSystem).toBeUndefined();
      expect(firstCall.update.name).toBe('内容创作');
      expect(firstCall.update.description).toBeDefined();
      expect(firstCall.update.prompt).toBeDefined();
    });
  });

  // ── createAgent 关联 skillIds ──────────────────────────────────────

  describe('createAgent (with skillIds)', () => {
    it('should create agent and link multiple skills via agentSkill', async () => {
      const created = { id: 'agent-1', tenantId: 't1', name: '客服Bot' };
      mockPrisma.agent.create.mockResolvedValue(created);
      mockPrisma.agentSkill.create.mockResolvedValue({ id: 'as-1' });

      const result = await service.createAgent('t1', {
        name: '客服Bot',
        description: '自动回复',
        systemPrompt: '你是客服',
        skillIds: ['sk-1', 'sk-2'],
      });

      expect(result).toEqual(created);
      // agent.create 必传 tenantId + name + description + systemPrompt
      expect(mockPrisma.agent.create).toHaveBeenCalledWith({
        data: {
          tenantId: 't1',
          name: '客服Bot',
          description: '自动回复',
          systemPrompt: '你是客服',
          config: undefined,
        },
      });
      // skillIds.length=2 → 两次 agentSkill.create
      expect(mockPrisma.agentSkill.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.agentSkill.create).toHaveBeenNthCalledWith(1, {
        data: { agentId: 'agent-1', skillId: 'sk-1', priority: 0 },
      });
      expect(mockPrisma.agentSkill.create).toHaveBeenNthCalledWith(2, {
        data: { agentId: 'agent-1', skillId: 'sk-2', priority: 0 },
      });
    });

    it('should skip agentSkill creation when skillIds is empty/missing', async () => {
      mockPrisma.agent.create.mockResolvedValue({ id: 'agent-2' });

      await service.createAgent('t1', { name: '裸Agent' });

      expect(mockPrisma.agentSkill.create).not.toHaveBeenCalled();
    });
  });

  // ── executeTask 成功 ──────────────────────────────────────────────

  describe('executeTask (success path)', () => {
    it('should call LlmService.chat and mark agentTask as completed', async () => {
      mockPrisma.agent.findFirst.mockResolvedValue({
        id: 'agent-1', tenantId: 't1', systemPrompt: '你是助手', name: 'Bot',
      });
      const taskRow = {
        id: 'task-1', tenantId: 't1', agentId: 'agent-1', status: 'running',
      };
      mockPrisma.agentTask.create.mockResolvedValue(taskRow);
      mockPrisma.skill.findUnique.mockResolvedValue(null);
      // mock LLM 返回
      mockLlm.chat.mockResolvedValue({ content: 'mock out', tokensIn: 10, tokensOut: 20, durationMs: 100 });
      mockPrisma.agentTask.update.mockResolvedValue({});

      const result = await service.executeTask('t1', 'agent-1', '用户问题');

      // 1. LlmService.chat 必传 tenantId + scene + messages
      expect(mockLlm.chat).toHaveBeenCalledTimes(1);
      const chatCall = mockLlm.chat.mock.calls[0];
      expect(chatCall[0]).toBe('t1');
      expect(chatCall[1].scene).toBe('agent_task');
      expect(chatCall[1].messages).toEqual([
        { role: 'system', content: '你是助手' },
        { role: 'user', content: '用户问题' },
      ]);

      // 2. 返回值包含 output / tokensUsed
      expect(result.output).toBe('mock out');
      expect(result.tokensUsed).toBe(30); // 10 + 20
      expect(result.taskId).toBe('task-1');

      // 3. agentTask.update 把状态写为 completed
      const updateCall = mockPrisma.agentTask.update.mock.calls[0][0];
      expect(updateCall.where.id).toBe('task-1');
      expect(updateCall.data.status).toBe('completed');
      expect(updateCall.data.output).toBe('mock out');
      expect(updateCall.data.tokensUsed).toBe(30);
      expect(updateCall.data.finishedAt).toBeInstanceOf(Date);
    });
  });

  // ── executeTask 失败回写 ──────────────────────────────────────────

  describe('executeTask (failure path)', () => {
    it('should write status=failed to agentTask and rethrow when LLM throws', async () => {
      mockPrisma.agent.findFirst.mockResolvedValue({
        id: 'agent-1', tenantId: 't1', systemPrompt: 'p', name: 'Bot',
      });
      mockPrisma.agentTask.create.mockResolvedValue({ id: 'task-2', tenantId: 't1' });
      mockPrisma.skill.findUnique.mockResolvedValue(null);
      mockLlm.chat.mockRejectedValue(new Error('AI 调用失败: 上游 500'));
      mockPrisma.agentTask.update.mockResolvedValue({});

      await expect(service.executeTask('t1', 'agent-1', 'q'))
        .rejects.toThrow('AI 调用失败');

      // 失败回写: status=failed, errorMsg 记录, finishedAt
      const updateCall = mockPrisma.agentTask.update.mock.calls[0][0];
      expect(updateCall.where.id).toBe('task-2');
      expect(updateCall.data.status).toBe('failed');
      expect(updateCall.data.errorMsg).toContain('AI 调用失败');
      expect(updateCall.data.finishedAt).toBeInstanceOf(Date);
      // 关键: 失败时不应有 output / tokensUsed
      expect(updateCall.data.output).toBeUndefined();
    });

    it('should throw NotFoundException when agent not in tenant', async () => {
      mockPrisma.agent.findFirst.mockResolvedValue(null);

      await expect(service.executeTask('tenant-A', 'agent-of-tenant-B', 'q'))
        .rejects.toThrow(NotFoundException);

      // 越权防护: findFirst 必带 tenantId
      const findCall = mockPrisma.agent.findFirst.mock.calls[0][0];
      expect(findCall.where.tenantId).toBe('tenant-A');
      // 不应调 LLM
      expect(mockLlm.chat).not.toHaveBeenCalled();
    });
  });
});
