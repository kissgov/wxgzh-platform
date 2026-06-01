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
  },
  followerTag: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  followerTagRelation: {
    findMany: jest.fn(),
    create: jest.fn(),
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
});
