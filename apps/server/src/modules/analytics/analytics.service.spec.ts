// AnalyticsService 单元测试 — 趋势聚合 / 看板 / RFM / 漏斗
// ============================================================================
import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrisma: any = {
  followerStat: { findMany: jest.fn(), aggregate: jest.fn() },
  messageStat: { findMany: jest.fn(), aggregate: jest.fn() },
  newsStat: { findMany: jest.fn(), count: jest.fn() },
  follower: { findMany: jest.fn(), count: jest.fn() },
  followerEvent: { count: jest.fn() },
  rfmSegment: { groupBy: jest.fn(), upsert: jest.fn() },
  conversionFunnel: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
  },
};

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<AnalyticsService>(AnalyticsService);
  });

  // ── getFollowerTrend 时间范围聚合 ──────────────────────────────────

  describe('getFollowerTrend (date-range aggregation)', () => {
    it('should query followerStat by authorizerId + date range and aggregate summary', async () => {
      const rows = [
        { statDate: new Date('2026-06-01'), totalFollowers: 1000,
          newSubscribers: 10, unsubscribers: 2, netGrowth: 8 },
        { statDate: new Date('2026-06-02'), totalFollowers: 1008,
          newSubscribers: 15, unsubscribers: 3, netGrowth: 12 },
      ];
      mockPrisma.followerStat.findMany.mockResolvedValue(rows);

      const result = await service.getFollowerTrend('a1', '2026-06-01', '2026-06-30');

      // 1. where 必须带 authorizerId + 时间范围
      const call = mockPrisma.followerStat.findMany.mock.calls[0][0];
      expect(call.where.authorizerId).toBe('a1');
      expect(call.where.statDate).toEqual({
        gte: new Date('2026-06-01'),
        lte: new Date('2026-06-30'),
      });
      expect(call.orderBy).toEqual({ statDate: 'asc' });

      // 2. summary 聚合: newSubs=25, unsubs=5, netGrowth=20
      expect(result.summary.newSubscribers).toBe(25);
      expect(result.summary.unsubscribers).toBe(5);
      expect(result.summary.netGrowth).toBe(20);
      // 3. series 长度 = 数据行数
      expect(result.series).toHaveLength(2);
      expect(result.series[0]!.date).toBe('2026-06-01');
    });

    it('should return zero summary when no stats in range', async () => {
      mockPrisma.followerStat.findMany.mockResolvedValue([]);

      const result = await service.getFollowerTrend('a1', '2026-01-01', '2026-01-31');

      expect(result.summary.newSubscribers).toBe(0);
      expect(result.summary.unsubscribers).toBe(0);
      expect(result.summary.netGrowth).toBe(0);
      expect(result.series).toEqual([]);
    });
  });

  // ── getMessageTrend 同比/环比 (replyRate 计算) ──────────────────────

  describe('getMessageTrend (reply rate)', () => {
    it('should compute replyRate = replied / received', async () => {
      const rows = [
        { statDate: new Date('2026-06-01'),
          sentCount: 100, receivedCount: 50, replyCount: 25, replyRate: 0.5 },
        { statDate: new Date('2026-06-02'),
          sentCount: 80, receivedCount: 40, replyCount: 16, replyRate: 0.4 },
      ];
      mockPrisma.messageStat.findMany.mockResolvedValue(rows);

      const result = await service.getMessageTrend('a1', '2026-06-01', '2026-06-30');

      // 累计: sent=180, received=90, replied=41
      expect(result.summary.sent).toBe(180);
      expect(result.summary.received).toBe(90);
      expect(result.summary.replied).toBe(41);
      // replyRate = 41/90 ≈ 0.4556
      expect(result.summary.replyRate).toBeCloseTo(41 / 90, 4);
    });

    it('should return replyRate=0 when received=0 (avoid div by zero)', async () => {
      mockPrisma.messageStat.findMany.mockResolvedValue([
        { statDate: new Date('2026-06-01'),
          sentCount: 50, receivedCount: 0, replyCount: 0, replyRate: 0 },
      ]);

      const result = await service.getMessageTrend('a1', '2026-06-01', '2026-06-30');

      expect(result.summary.received).toBe(0);
      // 必须为 0 而非 NaN/Infinity
      expect(result.summary.replyRate).toBe(0);
    });
  });

  // ── getNewsAnalysis 排行 ────────────────────────────────────────────

  describe('getNewsAnalysis (topN ordering)', () => {
    it('should order news by readCount desc with pagination', async () => {
      mockPrisma.newsStat.findMany.mockResolvedValue([
        { id: 'n1', title: '热门文章', readCount: 5000 },
        { id: 'n2', title: '普通文章', readCount: 500 },
      ]);
      mockPrisma.newsStat.count.mockResolvedValue(2);

      const result = await service.getNewsAnalysis('a1', '2026-06-01', '2026-06-30', 1, 10);

      expect(result.list).toHaveLength(2);
      expect(result.total).toBe(2);

      const call = mockPrisma.newsStat.findMany.mock.calls[0][0];
      // 按 readCount 倒序 (topN)
      expect(call.orderBy).toEqual({ readCount: 'desc' });
      // 范围 + 分页
      expect(call.where.authorizerId).toBe('a1');
      expect(call.skip).toBe(0);
      expect(call.take).toBe(10);
    });
  });

  // ── getOverview 看板 ────────────────────────────────────────────────

  describe('getOverview (30-day dashboard)', () => {
    it('should aggregate last 30 days followers and messages', async () => {
      mockPrisma.follower.count.mockResolvedValue(1500);
      mockPrisma.followerStat.aggregate.mockResolvedValue({
        _sum: { newSubscribers: 200, unsubscribers: 50 },
      });
      mockPrisma.messageStat.aggregate.mockResolvedValue({
        _sum: { sentCount: 1000, receivedCount: 500, replyCount: 0 },
      });

      const result = await service.getOverview('a1');

      // 看板字段
      expect(result.totalFollowers).toBe(1500);
      expect(result.last30Days.newSubscribers).toBe(200);
      expect(result.last30Days.unsubscribers).toBe(50);
      // netGrowth = new - unsubs = 150
      expect(result.last30Days.netGrowth).toBe(150);
      expect(result.messages.sent).toBe(1000);
      expect(result.messages.received).toBe(500);

      // followerStat.aggregate 必传 statDate.gte (30天前)
      const aggCall = mockPrisma.followerStat.aggregate.mock.calls[0][0];
      expect(aggCall.where.statDate.gte).toBeInstanceOf(Date);
    });
  });

  // ── getRfmOverview 分布 ─────────────────────────────────────────────

  describe('getRfmOverview (segment distribution)', () => {
    it('should map segment codes to Chinese labels', async () => {
      mockPrisma.rfmSegment.groupBy.mockResolvedValue([
        { segment: 'champions', _count: 100 },
        { segment: 'loyal', _count: 250 },
        { segment: 'at_risk', _count: 50 },
      ]);

      const result = await service.getRfmOverview('a1');

      expect(result).toEqual([
        { segment: 'champions', label: '核心用户', count: 100 },
        { segment: 'loyal', label: '忠诚用户', count: 250 },
        { segment: 'at_risk', label: '流失风险', count: 50 },
      ]);
    });
  });

  // ── getFunnelData 转化率 (rate 字符串) ──────────────────────────────

  describe('getFunnelData (conversion rate)', () => {
    it('should compute step rates as percentage string', async () => {
      mockPrisma.conversionFunnel.findFirst.mockResolvedValue({
        id: 'f1', tenantId: 't1', authorizerId: 'a1',
        steps: [
          { key: 's1', label: '访问', eventType: 'visit' },
          { key: 's2', label: '注册', eventType: 'register' },
          { key: 's3', label: '付费', eventType: 'pay' },
        ],
      });
      // 三步事件计数: 1000, 500, 100
      mockPrisma.followerEvent.count
        .mockResolvedValueOnce(1000)
        .mockResolvedValueOnce(500)
        .mockResolvedValueOnce(100);

      const result = await service.getFunnelData('t1', 'f1');

      expect(result).not.toBeNull();
      const data = (result as any).data;
      expect(data).toHaveLength(3);
      // 步骤1: 起点 rate=100%
      expect(data[0]!.rate).toBe('100%');
      // 步骤2: 500/1000 = 50%
      expect(data[1]!.rate).toBe('50.0%');
      // 步骤3: 100/500 = 20%
      expect(data[2]!.rate).toBe('20.0%');
    });

    it('should return null when funnel not in tenant', async () => {
      mockPrisma.conversionFunnel.findFirst.mockResolvedValue(null);

      const result = await service.getFunnelData('tenant-A', 'funnel-of-tenant-B');

      expect(result).toBeNull();
      expect(mockPrisma.followerEvent.count).not.toHaveBeenCalled();
    });
  });
});
