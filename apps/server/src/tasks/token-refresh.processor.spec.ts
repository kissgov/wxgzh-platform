// TokenRefreshProcessor 单元测试 — 扫描 + 刷新 + 失败重抛
// ============================================================================
import { Test, TestingModule } from '@nestjs/testing';
import { TokenRefreshProcessor } from './token-refresh.processor';
import { PrismaService } from '../prisma/prisma.service';
import { WechatService } from '../integrations/wechat/wechat.service';

const mockPrisma: any = {
  authorizer: {
    findMany: jest.fn(),
  },
};

const mockWechat: any = {
  refreshAuthorizerToken: jest.fn(),
};

const makeJob = (data: { authorizerId: string }) =>
  ({ data, id: 'job-1', name: 'refresh', attemptsMade: 0 } as any);

describe('TokenRefreshProcessor', () => {
  let processor: TokenRefreshProcessor;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenRefreshProcessor,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: WechatService, useValue: mockWechat },
      ],
    }).compile();
    processor = module.get<TokenRefreshProcessor>(TokenRefreshProcessor);
  });

  // ── process() 单任务刷新 ────────────────────────────────────────

  describe('process()', () => {
    it('should call refreshAuthorizerToken and not throw on success', async () => {
      mockWechat.refreshAuthorizerToken.mockResolvedValue('new_token');

      await expect(processor.process(makeJob({ authorizerId: 'auth-1' }))).resolves.toBeUndefined();
      expect(mockWechat.refreshAuthorizerToken).toHaveBeenCalledWith('auth-1');
    });

    it('should rethrow error so BullMQ retries the job', async () => {
      const err = new Error('Wechat API timeout');
      mockWechat.refreshAuthorizerToken.mockRejectedValue(err);

      await expect(processor.process(makeJob({ authorizerId: 'auth-2' }))).rejects.toThrow('Wechat API timeout');
    });
  });

  // ── scheduleRefresh() 扫描入口 ──────────────────────────────

  describe('scheduleRefresh()', () => {
    it('should return empty list when no authorizers need refresh', async () => {
      mockPrisma.authorizer.findMany.mockResolvedValue([]);

      const results = await processor.scheduleRefresh();

      expect(results).toEqual([]);
      expect(mockWechat.refreshAuthorizerToken).not.toHaveBeenCalled();
      // 必须查了 5 分钟过期窗口
      const call = mockPrisma.authorizer.findMany.mock.calls[0][0];
      expect(call.where.status).toBe('authorized');
      expect(call.where.tokenExpireAt).toHaveProperty('lte');
    });

    it('should refresh all matched authorizers and tag success', async () => {
      mockPrisma.authorizer.findMany.mockResolvedValue([{ id: 'a1' }, { id: 'a2' }]);
      mockWechat.refreshAuthorizerToken.mockResolvedValue('t');

      const results = await processor.scheduleRefresh();

      expect(results).toEqual([
        { authorizerId: 'a1', status: 'refreshed' },
        { authorizerId: 'a2', status: 'refreshed' },
      ]);
      expect(mockWechat.refreshAuthorizerToken).toHaveBeenCalledTimes(2);
    });

    it('should record per-authorizer failure but continue scanning', async () => {
      mockPrisma.authorizer.findMany.mockResolvedValue([{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }]);
      mockWechat.refreshAuthorizerToken
        .mockResolvedValueOnce('t')
        .mockRejectedValueOnce(new Error('net'))
        .mockResolvedValueOnce('t');

      const results = await processor.scheduleRefresh();

      expect(results).toEqual([
        { authorizerId: 'a1', status: 'refreshed' },
        { authorizerId: 'a2', status: 'failed', error: 'net' },
        { authorizerId: 'a3', status: 'refreshed' },
      ]);
    });
  });
});
