// FollowerService 单元测试 — 粉丝列表/筛选/标签/越权防护
// ============================================================================
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { FollowerService } from './follower.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrisma: any = {
  follower: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  followerTag: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  followerTagRelation: {
    findMany: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
  tagRule: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  tagRuleExecutionLog: {
    create: jest.fn(),
  },
  blacklist: {
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
};

describe('FollowerService', () => {
  let service: FollowerService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FollowerService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<FollowerService>(FollowerService);
  });

  // ── getFollowers 分页 ──────────────────────────────────────────────────

  describe('getFollowers (pagination)', () => {
    it('should return paginated list and total count', async () => {
      // 5 followers total, page=1, page_size=3 → 3 returned
      const rows = [
        { id: 'f1', nickname: 'A', openid: 'o1', tagRelations: [] },
        { id: 'f2', nickname: 'B', openid: 'o2', tagRelations: [] },
        { id: 'f3', nickname: 'C', openid: 'o3', tagRelations: [] },
      ];
      mockPrisma.follower.findMany.mockResolvedValue(rows);
      mockPrisma.follower.count.mockResolvedValue(5);

      const result = await service.getFollowers('t1', 'a1', {
        page: 1, page_size: 3,
      });

      expect(result.list).toHaveLength(3);
      expect(result.total).toBe(5);
      expect(result.page).toBe(1);
      expect(result.page_size).toBe(3);

      // 验证分页参数透传到 prisma (skip=0, take=3)
      const findCall = mockPrisma.follower.findMany.mock.calls[0][0];
      expect(findCall.skip).toBe(0);
      expect(findCall.take).toBe(3);
      // 基础 where: tenantId + authorizerId + subscribe + deletedAt=null
      expect(findCall.where.tenantId).toBe('t1');
      expect(findCall.where.authorizerId).toBe('a1');
      expect(findCall.where.subscribe).toBe(true);
      expect(findCall.where.deletedAt).toBeNull();
    });
  });

  // ── getFollowers 关键词过滤 ───────────────────────────────────────────

  describe('getFollowers (keyword filter)', () => {
    it('should build OR query on nickname/remark/openid when keyword given', async () => {
      mockPrisma.follower.findMany.mockResolvedValue([
        { id: 'fa', nickname: 'Alice', openid: 'oa', tagRelations: [] },
      ]);
      mockPrisma.follower.count.mockResolvedValue(1);

      await service.getFollowers('t1', 'a1', { keyword: 'Alice' });

      const findCall = mockPrisma.follower.findMany.mock.calls[0][0];
      // keyword 必须用 OR 匹配 nickname/remark/openid
      expect(findCall.where.OR).toEqual([
        { nickname: { contains: 'Alice' } },
        { remark: { contains: 'Alice' } },
        { openid: { contains: 'Alice' } },
      ]);
    });

    it('should not add OR clause when keyword missing', async () => {
      mockPrisma.follower.findMany.mockResolvedValue([]);
      mockPrisma.follower.count.mockResolvedValue(0);

      await service.getFollowers('t1', 'a1', { page: 1, page_size: 10 });

      const findCall = mockPrisma.follower.findMany.mock.calls[0][0];
      expect(findCall.where.OR).toBeUndefined();
    });
  });

  // ── getFollowers tagId 过滤 ───────────────────────────────────────────

  describe('getFollowers (tagId filter)', () => {
    it('should look up follower ids via followerTagRelation then filter', async () => {
      // 模拟已有 2 个 follower 绑定到 tag 'tag-1'
      mockPrisma.followerTagRelation.findMany.mockResolvedValue([
        { followerId: 'f-tagged-1' },
        { followerId: 'f-tagged-2' },
      ]);
      mockPrisma.follower.findMany.mockResolvedValue([
        { id: 'f-tagged-1', nickname: 'Tagged1', tagRelations: [] },
      ]);
      mockPrisma.follower.count.mockResolvedValue(1);

      const result = await service.getFollowers('t1', 'a1', { tagId: 'tag-1' });

      // followerTagRelation 必须以 tagId 过滤
      const relCall = mockPrisma.followerTagRelation.findMany.mock.calls[0][0];
      expect(relCall.where.tagId).toBe('tag-1');

      // follower.findMany 的 where.id 必须为 in [tagged ids]
      const findCall = mockPrisma.follower.findMany.mock.calls[0][0];
      expect(findCall.where.id).toEqual({ in: ['f-tagged-1', 'f-tagged-2'] });

      expect(result.list).toHaveLength(1);
    });
  });

  // ── getFollowerDetail 越权防护 ─────────────────────────────────────────

  describe('getFollowerDetail (cross-tenant guard)', () => {
    it('should throw NotFoundException when follower not in tenant', async () => {
      mockPrisma.follower.findFirst.mockResolvedValue(null);

      await expect(
        service.getFollowerDetail('tenant-A', 'follower-of-tenant-B'),
      ).rejects.toThrow(NotFoundException);

      // 越权防护: findFirst 必带 tenantId
      const findCall = mockPrisma.follower.findFirst.mock.calls[0][0];
      expect(findCall.where.tenantId).toBe('tenant-A');
      expect(findCall.where.deletedAt).toBeNull();
    });

    it('should return follower with flattened tags array', async () => {
      mockPrisma.follower.findFirst.mockResolvedValue({
        id: 'f1', tenantId: 't1', nickname: 'Alice', openid: 'o1',
        tagRelations: [
          { tag: { id: 'tag-1', name: 'VIP', color: '#f00' } },
        ],
      });

      const result = await service.getFollowerDetail('t1', 'f1');

      expect(result.id).toBe('f1');
      expect(result.tags).toEqual([{ id: 'tag-1', name: 'VIP', color: '#f00' }]);
      // tagRelations 不应泄漏到返回
      expect(result.tagRelations).toBeUndefined();
    });
  });

  // ── deleteTag 软删 ────────────────────────────────────────────────────

  describe('deleteTag (soft delete)', () => {
    it('should set deletedAt and return deleted:true', async () => {
      mockPrisma.followerTag.update.mockResolvedValue({});

      const result = await service.deleteTag('tag-1', 't1');

      expect(result).toEqual({ deleted: true });
      // 软删: 必传 tenantId (越权防护) + deletedAt
      expect(mockPrisma.followerTag.update).toHaveBeenCalledWith({
        where: { id: 'tag-1', tenantId: 't1' },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });

  // ── getFollowers 进阶筛选 + 排序 ──────────────────────────────────────

  describe('getFollowers (sex/province/date/sort)', () => {
    it('should convert sex string to int and add date range', async () => {
      mockPrisma.follower.findMany.mockResolvedValue([]);
      mockPrisma.follower.count.mockResolvedValue(0);

      await service.getFollowers('t', 'a', {
        sex: '2', province: 'BJ',
        subscribeSince: '2026-01-01', subscribeUntil: '2026-01-31',
        sort: 'nickname', order: 'asc',
      });

      const w = mockPrisma.follower.findMany.mock.calls[0][0].where;
      expect(w.sex).toBe(2);
      expect(w.province).toBe('BJ');
      expect(w.subscribeAt.gte).toEqual(new Date('2026-01-01'));
      expect(w.subscribeAt.lte).toEqual(new Date('2026-01-31'));
      const o = mockPrisma.follower.findMany.mock.calls[0][0].orderBy;
      expect(o).toEqual({ nickname: 'asc' });
    });
  });

  // ── 标签管理 ──────────────────────────────────────────────────────────

  describe('tag management', () => {
    it('getTags should order by createdAt asc and filter by authorizerId+deletedAt', async () => {
      mockPrisma.followerTag.findMany.mockResolvedValue([]);
      await service.getTags('a1');
      const w = mockPrisma.followerTag.findMany.mock.calls[0][0];
      expect(w.where.authorizerId).toBe('a1');
      expect(w.where.deletedAt).toBeNull();
      expect(w.orderBy).toEqual({ createdAt: 'asc' });
    });

    it('createTag should create + log', async () => {
      mockPrisma.followerTag.create.mockResolvedValue({ id: 't1', name: 'VIP' });
      const tag = await service.createTag('a1', 't1', { name: 'VIP', color: '#f00' });
      expect(tag.id).toBe('t1');
      expect(mockPrisma.followerTag.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: 'VIP', color: '#f00' }) }),
      );
    });

    it('updateTag should pass tenantId for cross-tenant guard', async () => {
      mockPrisma.followerTag.update.mockResolvedValue({});
      await service.updateTag('t1', 'tenant-1', { name: 'X' });
      expect(mockPrisma.followerTag.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 't1', tenantId: 'tenant-1' } }),
      );
    });
  });

  // ── 批量打标签 ────────────────────────────────────────────────────────

  describe('batchTag / batchUntag', () => {
    it('batchTag should create cartesian product (followerIds × tagIds)', async () => {
      mockPrisma.followerTagRelation.create.mockResolvedValue({});
      const r = await service.batchTag('t1', { followerIds: ['f1', 'f2'], tagIds: ['tagA', 'tagB'] });
      expect(r.total).toBe(4);
      expect(mockPrisma.followerTagRelation.create).toHaveBeenCalledTimes(4);
    });

    it('batchTag should swallow duplicate-key errors but count success', async () => {
      mockPrisma.followerTagRelation.create
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('Unique constraint'));
      const r = await service.batchTag('t1', { followerIds: ['f1'], tagIds: ['tagA', 'tagB'] });
      expect(r.success).toBe(1);
      expect(r.total).toBe(2);
    });

    it('batchUntag should return removed:0 when no valid tags in tenant', async () => {
      mockPrisma.followerTag.findMany.mockResolvedValue([]);
      const r = await service.batchUntag('t1', { followerIds: ['f1'], tagIds: ['tagX'] });
      expect(r).toEqual({ removed: 0 });
      expect(mockPrisma.followerTagRelation.deleteMany).not.toHaveBeenCalled();
    });

    it('batchUntag should scope deleteMany to followerIds×validTagIds', async () => {
      mockPrisma.followerTag.findMany.mockResolvedValue([{ id: 'tagA' }]);
      mockPrisma.followerTagRelation.deleteMany.mockResolvedValue({ count: 2 });
      const r = await service.batchUntag('t1', { followerIds: ['f1', 'f2'], tagIds: ['tagA'] });
      expect(r).toEqual({ removed: 2 });
      const w = mockPrisma.followerTagRelation.deleteMany.mock.calls[0][0].where;
      expect(w.followerId).toEqual({ in: ['f1', 'f2'] });
      expect(w.tagId).toEqual({ in: ['tagA'] });
    });
  });

  // ── 标签规则 ──────────────────────────────────────────────────────────

  describe('tag rules', () => {
    it('getTagRules should include target tag and order desc', async () => {
      mockPrisma.tagRule.findMany.mockResolvedValue([]);
      await service.getTagRules('a1');
      const w = mockPrisma.tagRule.findMany.mock.calls[0][0];
      expect(w.where.authorizerId).toBe('a1');
      expect(w.orderBy).toEqual({ createdAt: 'desc' });
    });

    it('createTagRule should map conditions to Json', async () => {
      mockPrisma.tagRule.create.mockResolvedValue({ id: 'r1' });
      const dto = {
        name: 'R', description: 'd', logic: 'AND', targetTagId: 't1',
        conditions: [{ field: 'sex', operator: 'eq', value: 1 }],
      };
      await service.createTagRule('tenant-1', 'a1', dto);
      expect(mockPrisma.tagRule.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ conditions: dto.conditions }) }),
      );
    });

    it('updateTagRule should spread dto and cast conditions', async () => {
      mockPrisma.tagRule.update.mockResolvedValue({});
      await service.updateTagRule('r1', { name: 'New', conditions: [] });
      expect(mockPrisma.tagRule.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'r1' }, data: expect.objectContaining({ name: 'New' }) }),
      );
    });

    it('deleteTagRule should soft delete', async () => {
      mockPrisma.tagRule.update.mockResolvedValue({});
      const r = await service.deleteTagRule('r1');
      expect(r).toEqual({ deleted: true });
      expect(mockPrisma.tagRule.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { deletedAt: expect.any(Date) } }),
      );
    });

    it('executeTagRule should throw if rule missing/disabled', async () => {
      mockPrisma.tagRule.findUnique.mockResolvedValue(null);
      await expect(service.executeTagRule('r1')).rejects.toThrow('规则不存在或已禁用');
    });

    it('executeTagRule should build WHERE with multi-operator conditions and tag matched followers', async () => {
      mockPrisma.tagRule.findUnique.mockResolvedValue({
        id: 'r1', name: 'NewFans', status: 'enabled',
        authorizerId: 'a1', targetTagId: 't1',
        conditions: [
          { field: 'subscribeAt', operator: 'days_ago_lte', value: 7 },
          { field: 'city', operator: 'in', value: ['上海', '北京'] },
        ],
      });
      mockPrisma.follower.findMany.mockResolvedValue([{ id: 'f1' }, { id: 'f2' }]);
      mockPrisma.followerTagRelation.create.mockResolvedValue({});
      mockPrisma.tagRuleExecutionLog.create.mockResolvedValue({});
      mockPrisma.tagRule.update.mockResolvedValue({});

      const r = await service.executeTagRule('r1');

      expect(r).toEqual({ affected: 2, tagged: 2 });
      const w = mockPrisma.follower.findMany.mock.calls[0][0].where;
      expect(w.authorizerId).toBe('a1');
      expect(w.subscribe).toBe(true);
      expect(w.subscribeAt).toHaveProperty('gte');
      expect(w.city).toEqual({ in: ['上海', '北京'] });
      expect(mockPrisma.tagRuleExecutionLog.create).toHaveBeenCalled();
      expect(mockPrisma.tagRule.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ lastExecCount: 2 }) }),
      );
    });

    it('executeTagRule should swallow duplicate tag relation errors', async () => {
      mockPrisma.tagRule.findUnique.mockResolvedValue({
        id: 'r2', name: 'Dups', status: 'enabled',
        authorizerId: 'a1', targetTagId: 't1',
        conditions: [{ field: 'sex', operator: 'eq', value: 1 }],
      });
      mockPrisma.follower.findMany.mockResolvedValue([{ id: 'f1' }, { id: 'f2' }]);
      mockPrisma.followerTagRelation.create
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('Unique constraint'));
      mockPrisma.tagRuleExecutionLog.create.mockResolvedValue({});
      mockPrisma.tagRule.update.mockResolvedValue({});

      const r = await service.executeTagRule('r2');
      expect(r).toEqual({ affected: 2, tagged: 1 });
    });
  });

  // ── 黑名单 ────────────────────────────────────────────────────────────

  describe('blacklist', () => {
    it('getBlacklist should paginate', async () => {
      mockPrisma.blacklist.findMany.mockResolvedValue([{ id: 'b1' }]);
      mockPrisma.blacklist.count.mockResolvedValue(1);
      const r = await service.getBlacklist('a1', 2, 5);
      expect(r.total).toBe(1);
      const w = mockPrisma.blacklist.findMany.mock.calls[0][0];
      expect(w.skip).toBe(5);   // (2-1)*5
      expect(w.take).toBe(5);
    });

    it('addToBlacklist should pass reason if provided', async () => {
      mockPrisma.blacklist.create.mockResolvedValue({});
      await service.addToBlacklist('a1', 'f1', 'spam');
      expect(mockPrisma.blacklist.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { authorizerId: 'a1', followerId: 'f1', reason: 'spam' } }),
      );
    });

    it('removeFromBlacklist should deleteMany with composite where', async () => {
      mockPrisma.blacklist.deleteMany.mockResolvedValue({ count: 1 });
      const r = await service.removeFromBlacklist('a1', 'f1');
      expect(r).toEqual({ removed: true });
      expect(mockPrisma.blacklist.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { authorizerId: 'a1', followerId: 'f1' } }),
      );
    });
  });

  // ── 画像 ──────────────────────────────────────────────────────────────

  describe('getPortrait', () => {
    it('should return gender ratios + top10 provinces', async () => {
      mockPrisma.follower.count.mockResolvedValue(100);
      mockPrisma.follower.groupBy
        .mockResolvedValueOnce([{ sex: 1, _count: 40 }, { sex: 2, _count: 50 }, { sex: 0, _count: 10 }])
        .mockResolvedValueOnce([
          { province: 'GD', _count: 30 }, { province: 'BJ', _count: 20 },
          { province: null, _count: 5 },   // 过滤掉
          { province: 'SH', _count: 15 },
        ]);

      const r = await service.getPortrait('a1');

      expect(r.totalFollowers).toBe(100);
      expect(r.gender.male).toBe(0.4);
      expect(r.gender.female).toBe(0.5);
      expect(r.gender.unknown).toBe(0.1);
      expect(r.region).toHaveLength(3);  // null 被过滤
      expect(r.region[0]).toEqual({ province: 'GD', count: 30 });
    });

    it('should return zeros when no followers exist', async () => {
      mockPrisma.follower.count.mockResolvedValue(0);
      mockPrisma.follower.groupBy.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const r = await service.getPortrait('a1');
      expect(r.gender).toEqual({ male: 0, female: 0, unknown: 0 });
      expect(r.region).toEqual([]);
    });
  });
});
