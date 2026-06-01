// MessageService 单元测试 — 自动回复规则 / 关键词匹配 / 群发消息
// ============================================================================
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MessageService } from './message.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrisma: any = {
  messageLog: { findMany: jest.fn(), count: jest.fn() },
  autoReplyRule: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  keywordReply: { deleteMany: jest.fn() },
  replyContent: { deleteMany: jest.fn() },
  broadcastMessage: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('MessageService', () => {
  let service: MessageService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<MessageService>(MessageService);
  });

  // ── createAutoReplyRule ───────────────────────────────────────────────

  describe('createAutoReplyRule', () => {
    it('should create rule with nested keywordReplies and replyContents', async () => {
      const created = { id: 'r1', name: '欢迎语', status: 'enabled' };
      mockPrisma.autoReplyRule.create.mockResolvedValue(created);

      const result = await service.createAutoReplyRule('t1', 'a1', {
        ruleType: 'follow',
        name: '欢迎语',
        keywordReplies: [{ matchType: 'exact', keyword: 'hi' }],
        replyContents: [{ contentType: 'text', content: 'Hello', sortOrder: 0 }],
      });

      expect(result).toEqual(created);
      const call = mockPrisma.autoReplyRule.create.mock.calls[0][0];
      // tenantId + authorizerId 必须传入
      expect(call.data.tenantId).toBe('t1');
      expect(call.data.authorizerId).toBe('a1');
      // nested write: keywordReplies.create
      expect(call.data.keywordReplies.create).toHaveLength(1);
      expect(call.data.keywordReplies.create[0]).toEqual({
        matchType: 'exact', keyword: 'hi',
      });
      // nested write: replyContents.create
      expect(call.data.replyContents.create[0]).toEqual({
        contentType: 'text', content: 'Hello', sortOrder: 0,
      });
    });
  });

  // ── matchKeywordReply 优先级 ──────────────────────────────────────────

  describe('matchKeywordReply (priority chain)', () => {
    it('should prefer exact match over fuzzy match', async () => {
      // 两条规则: rule-A.exact='hello' (priority 10), rule-B.fuzzy='hel' (priority 5)
      mockPrisma.autoReplyRule.findMany.mockResolvedValue([
        {
          id: 'rule-A', name: '精确回复', priority: 10,
          keywordReplies: [{ matchType: 'exact', keyword: 'hello' }],
          replyContents: [{ id: 'rc1', content: 'A' }],
        },
        {
          id: 'rule-B', name: '模糊回复', priority: 5,
          keywordReplies: [{ matchType: 'fuzzy', keyword: 'hel' }],
          replyContents: [{ id: 'rc2', content: 'B' }],
        },
      ]);

      const result = await service.matchKeywordReply('a1', 'hello');

      // 优先返回 exact 匹配的 rule-A, 而非 fuzzy 的 rule-B
      expect(result.id).toBe('rule-A');
    });

    it('should fall back to fuzzy when no exact match', async () => {
      mockPrisma.autoReplyRule.findMany.mockResolvedValue([
        {
          id: 'rule-fuzzy', priority: 0,
          keywordReplies: [{ matchType: 'fuzzy', keyword: 'price' }],
          replyContents: [{ content: '价格表...' }],
        },
      ]);
      // 无 default rule
      mockPrisma.autoReplyRule.findFirst.mockResolvedValue(null);

      const result = await service.matchKeywordReply('a1', 'what is the price?');

      expect(result.id).toBe('rule-fuzzy');
    });

    it('should fall back to default rule when no keyword matches', async () => {
      mockPrisma.autoReplyRule.findMany.mockResolvedValue([]);
      mockPrisma.autoReplyRule.findFirst.mockResolvedValue({
        id: 'rule-default', name: '默认回复', ruleType: 'default',
        replyContents: [{ content: '未识别' }],
      });

      const result = await service.matchKeywordReply('a1', 'random input');

      expect(result.id).toBe('rule-default');
      // findFirst 必须以 authorizerId + ruleType=default 查
      const call = mockPrisma.autoReplyRule.findFirst.mock.calls[0][0];
      expect(call.where.authorizerId).toBe('a1');
      expect(call.where.ruleType).toBe('default');
      expect(call.where.status).toBe('enabled');
    });
  });

  // ── createBroadcast + getBroadcasts ──────────────────────────────────

  describe('broadcast CRUD', () => {
    it('should create broadcast as draft when no scheduledAt', async () => {
      mockPrisma.broadcastMessage.create.mockImplementation(async ({ data }: any) => ({
        id: 'bc1', ...data,
      }));

      const result = await service.createBroadcast('t1', 'a1', {
        msgType: 'text',
        content: { text: 'hello' },
        targetType: 'all',
      });

      expect(result.status).toBe('draft');
      expect(result.scheduledAt).toBeNull();
      expect(result.authorizerId).toBe('a1');
    });

    it('should create broadcast as pending when scheduledAt is set', async () => {
      mockPrisma.broadcastMessage.create.mockImplementation(async ({ data }: any) => ({
        id: 'bc2', ...data,
      }));

      const result = await service.createBroadcast('t1', 'a1', {
        msgType: 'text',
        content: { text: 'later' },
        scheduledAt: '2026-12-31T10:00:00Z',
      });

      // 定时任务: status 必须是 pending
      expect(result.status).toBe('pending');
      expect(result.scheduledAt).toEqual(new Date('2026-12-31T10:00:00Z'));
    });

    it('should paginate broadcasts filtered by authorizerId and exclude deleted', async () => {
      mockPrisma.broadcastMessage.findMany.mockResolvedValue([{ id: 'bc1' }]);
      mockPrisma.broadcastMessage.count.mockResolvedValue(1);

      const result = await service.getBroadcasts({
        authorizerId: 'a1', page: 1, page_size: 10,
      });

      expect(result.list).toHaveLength(1);
      expect(result.total).toBe(1);

      // 隔离: 必带 authorizerId + deletedAt=null
      const findCall = mockPrisma.broadcastMessage.findMany.mock.calls[0][0];
      expect(findCall.where.authorizerId).toBe('a1');
      expect(findCall.where.deletedAt).toBeNull();
      expect(findCall.skip).toBe(0);
      expect(findCall.take).toBe(10);
    });
  });

  // ── deleteAutoReplyRule 软删 + toggle ────────────────────────────────

  describe('deleteAutoReplyRule + toggleAutoReplyRule', () => {
    it('should soft delete by setting deletedAt', async () => {
      mockPrisma.autoReplyRule.update.mockResolvedValue({});

      const result = await service.deleteAutoReplyRule('r1');

      expect(result).toEqual({ deleted: true });
      expect(mockPrisma.autoReplyRule.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should throw NotFoundException when toggling missing rule', async () => {
      mockPrisma.autoReplyRule.findUnique.mockResolvedValue(null);

      await expect(
        service.toggleAutoReplyRule('r-missing'),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.autoReplyRule.update).not.toHaveBeenCalled();
    });

    it('should flip status from enabled to disabled', async () => {
      mockPrisma.autoReplyRule.findUnique.mockResolvedValue({ id: 'r1', status: 'enabled' });
      mockPrisma.autoReplyRule.update.mockResolvedValue({ id: 'r1', status: 'disabled' });

      const result = await service.toggleAutoReplyRule('r1');

      expect(result.status).toBe('disabled');
      expect(mockPrisma.autoReplyRule.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { status: 'disabled' },
      });
    });
  });
});
