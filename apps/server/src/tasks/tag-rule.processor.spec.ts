// TagRuleProcessor 单元测试 — 规则执行 + 调度全部
// ============================================================================
import { Test, TestingModule } from '@nestjs/testing';
import { TagRuleProcessor } from './tag-rule.processor';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma: any = {
  tagRule: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  follower: {
    findMany: jest.fn(),
  },
  followerTagRelation: {
    create: jest.fn(),
  },
  tagRuleExecutionLog: {
    create: jest.fn(),
  },
};

describe('TagRuleProcessor', () => {
  let processor: TagRuleProcessor;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [TagRuleProcessor, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    processor = module.get<TagRuleProcessor>(TagRuleProcessor);
  });

  // ── process() 入口 ─────────────────────────────────────────────

  describe('process()', () => {
    it('should return tagged/affected counts and write execution log', async () => {
      mockPrisma.tagRule.findUnique.mockResolvedValue({
        id: 'r1', name: 'NewFans', status: 'enabled',
        authorizerId: 'auth-1', targetTagId: 'tag-1',
        conditions: [{ field: 'subscribeAt', operator: 'days_ago_lte', value: 7 }],
      });
      mockPrisma.follower.findMany.mockResolvedValue([{ id: 'f1' }, { id: 'f2' }]);
      mockPrisma.followerTagRelation.create.mockResolvedValue({});
      mockPrisma.tagRuleExecutionLog.create.mockResolvedValue({});
      mockPrisma.tagRule.update.mockResolvedValue({});

      const result = await processor.process({ data: { ruleId: 'r1' } } as any);

      expect(result).toEqual({ affected: 2, tagged: 2 });
      expect(mockPrisma.followerTagRelation.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.tagRuleExecutionLog.create).toHaveBeenCalled();
      expect(mockPrisma.tagRule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'r1' },
          data: expect.objectContaining({ lastExecCount: 2 }),
        }),
      );
    });

    it('should skip if rule missing or disabled', async () => {
      mockPrisma.tagRule.findUnique.mockResolvedValue(null);

      await expect(processor.process({ data: { ruleId: 'r-missing' } } as any))
        .rejects.toThrow('Rule not found or disabled');
    });

    it('should swallow duplicate tag relation errors and only count new tags', async () => {
      mockPrisma.tagRule.findUnique.mockResolvedValue({
        id: 'r2', name: 'Dups', status: 'enabled',
        authorizerId: 'auth-1', targetTagId: 'tag-1',
        conditions: [{ field: 'sex', operator: 'eq', value: 1 }],
      });
      mockPrisma.follower.findMany.mockResolvedValue([{ id: 'f1' }, { id: 'f2' }]);
      mockPrisma.followerTagRelation.create
        .mockResolvedValueOnce({})       // 第一次成功
        .mockRejectedValueOnce(new Error('Unique constraint')); // 第二次重复
      mockPrisma.tagRuleExecutionLog.create.mockResolvedValue({});
      mockPrisma.tagRule.update.mockResolvedValue({});

      const result = await processor.process({ data: { ruleId: 'r2' } } as any);

      expect(result).toEqual({ affected: 2, tagged: 1 });
    });

    it('should build WHERE clause with multiple operators (gt, in, contains, days_ago_gte)', async () => {
      mockPrisma.tagRule.findUnique.mockResolvedValue({
        id: 'r-multi', name: 'Multi', status: 'enabled',
        authorizerId: 'auth-9', targetTagId: 'tag-9',
        conditions: [
          { field: 'lastInteractAt', operator: 'days_ago_gte', value: 30 },
          { field: 'city', operator: 'in', value: ['上海', '北京'] },
          { field: 'nickname', operator: 'contains', value: '张' },
        ],
      });
      mockPrisma.follower.findMany.mockResolvedValue([]);
      mockPrisma.tagRuleExecutionLog.create.mockResolvedValue({});
      mockPrisma.tagRule.update.mockResolvedValue({});

      await processor.process({ data: { ruleId: 'r-multi' } } as any);

      const call = mockPrisma.follower.findMany.mock.calls[0][0];
      expect(call.where.authorizerId).toBe('auth-9');
      expect(call.where.subscribe).toBe(true);
      expect(call.where.lastInteractAt).toHaveProperty('lte');
      expect(call.where.city).toEqual({ in: ['上海', '北京'] });
      expect(call.where.nickname).toEqual({ contains: '张' });
    });
  });

  // ── scheduleAllRules() ───────────────────────────────────────────

  describe('scheduleAllRules()', () => {
    it('should iterate all enabled rules and aggregate results', async () => {
      mockPrisma.tagRule.findMany.mockResolvedValue([{ id: 'r1' }, { id: 'r2' }]);
      mockPrisma.tagRule.findUnique
        .mockResolvedValueOnce({
          id: 'r1', name: 'A', status: 'enabled',
          authorizerId: 'auth', targetTagId: 't', conditions: [],
        })
        .mockResolvedValueOnce(null); // 第二条规则缺失
      mockPrisma.follower.findMany.mockResolvedValueOnce([{ id: 'f1' }]);
      mockPrisma.followerTagRelation.create.mockResolvedValue({});
      mockPrisma.tagRuleExecutionLog.create.mockResolvedValue({});
      mockPrisma.tagRule.update.mockResolvedValue({});

      const results = await processor.scheduleAllRules();

      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({ ruleId: 'r1', status: 'success', tagged: 1, affected: 1 });
      expect(results[1]).toMatchObject({ ruleId: 'r2', status: 'failed' });
    });
  });
});
