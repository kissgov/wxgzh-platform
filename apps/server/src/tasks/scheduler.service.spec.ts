// SchedulerService 单元测试 — 4 个 cron 入口 + 错误吞掉
// ============================================================================
import { Test, TestingModule } from '@nestjs/testing';
import { SchedulerService } from './scheduler.service';
import { TokenRefreshProcessor } from './token-refresh.processor';
import { TagRuleProcessor } from './tag-rule.processor';

// 直接对 PrismaClient (scheduler 自己 import) 做 mock
jest.mock('@prisma/client', () => {
  const authorizer: any = {
    findMany: jest.fn(),
  };
  const PrismaClient = jest.fn().mockImplementation(() => ({
    authorizer,
    $disconnect: jest.fn().mockResolvedValue(undefined),
  }));
  return { PrismaClient, __mock: { authorizer } };
});

// queue mock — BullMQ Queue 接口
const mockQueue: any = {
  add: jest.fn().mockResolvedValue({ id: 'job-1' }),
};

const mockTokenProc: any = {
  scheduleRefresh: jest.fn(),
};

const mockTagProc: any = {
  scheduleAllRules: jest.fn(),
};

describe('SchedulerService', () => {
  let service: SchedulerService;
  let prismaAuthorizer: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    // 拿到内部 mock 实例
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    prismaAuthorizer = require('@prisma/client').__mock.authorizer;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulerService,
        { provide: TokenRefreshProcessor, useValue: mockTokenProc },
        { provide: TagRuleProcessor, useValue: mockTagProc },
        { provide: 'BullQueue_sync-data', useValue: mockQueue },
      ],
    })
      // 覆盖 @InjectQueue 装饰器生成的 token
      .overrideProvider('BullQueue_sync-data')
      .useValue(mockQueue)
      .compile();
    service = module.get<SchedulerService>(SchedulerService);
  });

  // ── handleTokenRefresh ──────────────────────────────────────────

  describe('handleTokenRefresh()', () => {
    it('should call scheduleRefresh and log success summary', async () => {
      mockTokenProc.scheduleRefresh.mockResolvedValue([
        { status: 'refreshed' },
        { status: 'refreshed' },
        { status: 'failed' },
      ]);

      await service.handleTokenRefresh();

      expect(mockTokenProc.scheduleRefresh).toHaveBeenCalled();
    });

    it('should swallow processor errors without rethrowing', async () => {
      mockTokenProc.scheduleRefresh.mockRejectedValue(new Error('boom'));

      await expect(service.handleTokenRefresh()).resolves.toBeUndefined();
    });
  });

  // ── handleTagRuleExecution ──────────────────────────────────────

  describe('handleTagRuleExecution()', () => {
    it('should call scheduleAllRules', async () => {
      mockTagProc.scheduleAllRules.mockResolvedValue([]);
      await service.handleTagRuleExecution();
      expect(mockTagProc.scheduleAllRules).toHaveBeenCalled();
    });

    it('should swallow processor errors', async () => {
      mockTagProc.scheduleAllRules.mockRejectedValue(new Error('boom'));
      await expect(service.handleTagRuleExecution()).resolves.toBeUndefined();
    });
  });

  // ── handleFollowerSync ──────────────────────────────────────────

  describe('handleFollowerSync()', () => {
    it('should enqueue follower_sync job for each active authorizer', async () => {
      prismaAuthorizer.findMany.mockResolvedValue([
        { id: 'a1', tenantId: 't1' },
        { id: 'a2', tenantId: 't2' },
      ]);

      await service.handleFollowerSync();

      expect(mockQueue.add).toHaveBeenCalledTimes(2);
      expect(mockQueue.add.mock.calls[0][0]).toBe('sync-followers');
      expect(mockQueue.add.mock.calls[0][1]).toEqual({
        taskType: 'follower_sync',
        tenantId: 't1',
        authorizerId: 'a1',
      });
    });

    it('should log and skip when zero authorizers', async () => {
      prismaAuthorizer.findMany.mockResolvedValue([]);
      await service.handleFollowerSync();
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('should swallow prisma errors', async () => {
      prismaAuthorizer.findMany.mockRejectedValue(new Error('db down'));
      await expect(service.handleFollowerSync()).resolves.toBeUndefined();
    });
  });

  // ── handleDailyStatsSync ────────────────────────────────────────

  describe('handleDailyStatsSync()', () => {
    it('should enqueue 3 jobs (user_analysis, msg_analysis, news_analysis) per authorizer', async () => {
      prismaAuthorizer.findMany.mockResolvedValue([{ id: 'a1', tenantId: 't1' }]);

      await service.handleDailyStatsSync();

      expect(mockQueue.add).toHaveBeenCalledTimes(3);
      const types = mockQueue.add.mock.calls.map((c: any[]) => c[1].taskType);
      expect(types.sort()).toEqual(['msg_analysis', 'news_analysis', 'user_analysis']);
      // 所有 job name 必须是 sync-stats
      const names = mockQueue.add.mock.calls.map((c: any[]) => c[0]);
      expect(new Set(names)).toEqual(new Set(['sync-stats']));
    });

    it('should swallow errors', async () => {
      prismaAuthorizer.findMany.mockRejectedValue(new Error('boom'));
      await expect(service.handleDailyStatsSync()).resolves.toBeUndefined();
    });
  });
});
