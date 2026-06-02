// SyncDataProcessor 单元测试 — 4 类同步任务 + 失败更新 syncTask
// ============================================================================
import { Test, TestingModule } from '@nestjs/testing';
import { SyncDataProcessor } from './sync-data.processor';
import { PrismaService } from '../prisma/prisma.service';
import { WechatService } from '../integrations/wechat/wechat.service';

const mockPrisma: any = {
  syncTask: {
    create: jest.fn(),
    update: jest.fn(),
  },
  follower: {
    upsert: jest.fn(),
  },
  followerStat: {
    upsert: jest.fn(),
    updateMany: jest.fn(),
  },
  newsStat: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  messageStat: {
    upsert: jest.fn(),
  },
};

const mockWechat: any = {
  getFollowers: jest.fn(),
  batchGetUserInfo: jest.fn(),
  getUserSummary: jest.fn(),
  getUserCumulate: jest.fn(),
  getArticleSummary: jest.fn(),
  getUpstreamMsg: jest.fn(),
};

const makeJob = (data: { taskType: any; tenantId: string; authorizerId: string }) =>
  ({ data, id: 'job-x', name: 'sync', attemptsMade: 0 } as any);

describe('SyncDataProcessor', () => {
  let processor: SyncDataProcessor;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncDataProcessor,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: WechatService, useValue: mockWechat },
      ],
    }).compile();
    processor = module.get<SyncDataProcessor>(SyncDataProcessor);
  });

  // ── follower_sync ─────────────────────────────────────────────

  describe('follower_sync', () => {
    it('should paginate openids, batch 100, upsert and mark success', async () => {
      mockPrisma.syncTask.create.mockResolvedValue({ id: 'st-1' });
      mockPrisma.syncTask.update.mockResolvedValue({});

      // 第 1 页: 120 openids → 2 批；next_openid 触发第 2 页
      // 第 2 页: 0 openids → 终止
      mockWechat.getFollowers
        .mockResolvedValueOnce({
          total: 120, count: 120,
          data: { openid: Array.from({ length: 120 }, (_, i) => `o${i}`) },
          next_openid: 'o119',
        })
        .mockResolvedValueOnce({ total: 0, count: 0, data: { openid: [] }, next_openid: '' });

      mockWechat.batchGetUserInfo
        .mockResolvedValueOnce({
          user_info_list: [
            { openid: 'o0', nickname: 'n0', headimgurl: '', sex: 1, country: 'CN', province: 'GD', city: 'SZ',
              subscribe: 1, subscribe_time: 1700000000, subscribe_scene: 'ADD_SCENE_QR', qr_scene: 0, qr_scene_str: '',
              remark: '', unionid: 'u0', tagid_list: [] },
            { openid: 'o50', nickname: 'n50', headimgurl: '', sex: 2, country: 'CN', province: 'BJ', city: 'BJ',
              subscribe: 0, subscribe_time: 0, subscribe_scene: '', qr_scene: 0, qr_scene_str: '',
              remark: '', unionid: '', tagid_list: [] },
          ],
        })
        .mockResolvedValueOnce({ user_info_list: [] });

      mockPrisma.follower.upsert.mockResolvedValue({});

      const job = makeJob({ taskType: 'follower_sync', tenantId: 't1', authorizerId: 'a1' });
      await processor.process(job);

      expect(mockWechat.getFollowers).toHaveBeenCalledTimes(2);
      expect(mockWechat.batchGetUserInfo).toHaveBeenCalledTimes(2);
      expect(mockPrisma.follower.upsert).toHaveBeenCalledTimes(2);
      // 第一条记录: subscribe=1 → subscribeAt 转换自 unix 时间
      expect(mockPrisma.follower.upsert.mock.calls[0][0].create.subscribe).toBe(true);
      expect(mockPrisma.follower.upsert.mock.calls[0][0].create.subscribeAt)
        .toEqual(new Date(1700000000 * 1000));
      // 第二条: subscribe=0 → subscribe=false, subscribeAt=null
      expect(mockPrisma.follower.upsert.mock.calls[1][0].create.subscribe).toBe(false);
      expect(mockPrisma.follower.upsert.mock.calls[1][0].create.subscribeAt).toBeNull();

      expect(mockPrisma.syncTask.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'success' }) }),
      );
    });

    it('should break loop when openids empty (no API call on subsequent page)', async () => {
      mockPrisma.syncTask.create.mockResolvedValue({ id: 'st-2' });
      mockPrisma.syncTask.update.mockResolvedValue({});
      mockWechat.getFollowers.mockResolvedValue({ total: 0, count: 0, data: { openid: [] }, next_openid: '' });

      await processor.process(makeJob({ taskType: 'follower_sync', tenantId: 't', authorizerId: 'a' }));

      expect(mockWechat.getFollowers).toHaveBeenCalledTimes(1);
      expect(mockPrisma.follower.upsert).not.toHaveBeenCalled();
    });
  });

  // ── user_analysis ─────────────────────────────────────────────

  describe('user_analysis', () => {
    it('should upsert followerStat and updateMany cumulate', async () => {
      mockPrisma.syncTask.create.mockResolvedValue({ id: 'st-3' });
      mockPrisma.syncTask.update.mockResolvedValue({});
      mockWechat.getUserSummary.mockResolvedValue({
        list: [
          { ref_date: '2026-05-01', user_source: 0, new_user: 10, cancel_user: 2 },
          { ref_date: '2026-05-02', user_source: 1, new_user: 5, cancel_user: 1 },
        ],
      });
      mockWechat.getUserCumulate.mockResolvedValue({
        list: [
          { ref_date: '2026-05-01', cumulate_user: 1000 },
          { ref_date: '2026-05-02', cumulate_user: 1004 },
        ],
      });
      mockPrisma.followerStat.upsert.mockResolvedValue({});
      mockPrisma.followerStat.updateMany.mockResolvedValue({});

      await processor.process(makeJob({ taskType: 'user_analysis', tenantId: 't', authorizerId: 'a' }));

      expect(mockPrisma.followerStat.upsert).toHaveBeenCalledTimes(2);
      expect(mockPrisma.followerStat.upsert.mock.calls[0][0].create.netGrowth).toBe(8); // 10-2
      expect(mockPrisma.followerStat.updateMany).toHaveBeenCalledTimes(2);
    });

    it('should swallow API errors with warn but still mark task success', async () => {
      mockPrisma.syncTask.create.mockResolvedValue({ id: 'st-4' });
      mockPrisma.syncTask.update.mockResolvedValue({});
      mockWechat.getUserSummary.mockRejectedValue(new Error('API 48001'));

      await processor.process(makeJob({ taskType: 'user_analysis', tenantId: 't', authorizerId: 'a' }));

      // process() 仍视为成功 (try 内 catch 吞掉, 外层 try 不抛)
      expect(mockPrisma.syncTask.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'success' }) }),
      );
    });
  });

  // ── news_analysis ─────────────────────────────────────────────

  describe('news_analysis', () => {
    it('should create new stat when no existing, update otherwise', async () => {
      mockPrisma.syncTask.create.mockResolvedValue({ id: 'st-5' });
      mockPrisma.syncTask.update.mockResolvedValue({});
      mockWechat.getArticleSummary.mockResolvedValue({
        list: [
          { ref_date: '2026-05-01', msgid: 'm1', title: 't1',
            int_page_read_count: 100, ori_page_read_count: 20,
            add_to_fav_count: 5, share_count: 3,
            int_page_from_session_read_user: 10, int_page_from_hist_msg_read_user: 5,
            int_page_from_feed_read_user: 1, int_page_from_friends_read_user: 2,
            int_page_from_other_read_user: 0 },
        ],
      });
      mockPrisma.newsStat.findFirst.mockResolvedValueOnce(null);
      mockPrisma.newsStat.create.mockResolvedValue({});

      await processor.process(makeJob({ taskType: 'news_analysis', tenantId: 't', authorizerId: 'a' }));

      expect(mockPrisma.newsStat.create).toHaveBeenCalled();
      const c = mockPrisma.newsStat.create.mock.calls[0][0].data;
      expect(c.readCount).toBe(120); // 100+20
      expect(c.likeCount).toBe(5);
      expect(c.favorCount).toBe(5);
      expect(c.shareCount).toBe(3);
    });
  });

  // ── msg_analysis ───────────────────────────────────────────────

  describe('msg_analysis', () => {
    it('should aggregate msg_count per date and upsert messageStat', async () => {
      mockPrisma.syncTask.create.mockResolvedValue({ id: 'st-6' });
      mockPrisma.syncTask.update.mockResolvedValue({});
      mockWechat.getUpstreamMsg.mockResolvedValue({
        list: [
          { ref_date: '2026-05-01', msg_type: 1, msg_user: 1, msg_count: 10 },
          { ref_date: '2026-05-01', msg_type: 2, msg_user: 1, msg_count: 5 },
          { ref_date: '2026-05-02', msg_type: 1, msg_user: 1, msg_count: 7 },
        ],
      });
      mockPrisma.messageStat.upsert.mockResolvedValue({});

      await processor.process(makeJob({ taskType: 'msg_analysis', tenantId: 't', authorizerId: 'a' }));

      expect(mockPrisma.messageStat.upsert).toHaveBeenCalledTimes(2);
      const d1 = mockPrisma.messageStat.upsert.mock.calls[0][0].create;
      expect(d1.receivedCount).toBe(15);
      const d2 = mockPrisma.messageStat.upsert.mock.calls[1][0].create;
      expect(d2.receivedCount).toBe(7);
    });
  });

  // ── 失败路径 ──────────────────────────────────────────────────────

  describe('error path', () => {
    it('should mark task failed with errorMessage and rethrow', async () => {
      mockPrisma.syncTask.create.mockResolvedValue({ id: 'st-7' });
      mockPrisma.syncTask.update.mockResolvedValue({});
      mockWechat.getFollowers.mockRejectedValue(new Error('API down'));

      const job = makeJob({ taskType: 'follower_sync', tenantId: 't', authorizerId: 'a' });
      await expect(processor.process(job)).rejects.toThrow('API down');

      // 第二次 update: status=failed + errorMessage
      const failedCall = mockPrisma.syncTask.update.mock.calls.find(
        (c: any[]) => c[0].data.status === 'failed',
      );
      expect(failedCall).toBeDefined();
      expect(failedCall[0].data.errorMessage).toBe('API down');
    });

    it('should truncate long errorMessage to 500 chars', async () => {
      mockPrisma.syncTask.create.mockResolvedValue({ id: 'st-8' });
      mockPrisma.syncTask.update.mockResolvedValue({});
      const longMsg = 'X'.repeat(800);
      mockWechat.getFollowers.mockRejectedValue(new Error(longMsg));

      await expect(processor.process(makeJob({ taskType: 'follower_sync', tenantId: 't', authorizerId: 'a' })))
        .rejects.toThrow();

      const failedCall = mockPrisma.syncTask.update.mock.calls.find(
        (c: any[]) => c[0].data.status === 'failed',
      );
      expect(failedCall[0].data.errorMessage).toHaveLength(500);
    });
  });
});
