// MaterialService 单元测试 — 素材 CRUD / 租户隔离 / 软删
// ============================================================================
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MaterialService } from './material.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrisma: any = {
  material: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    groupBy: jest.fn(),
  },
  materialUsageLog: { create: jest.fn() },
};

describe('MaterialService', () => {
  let service: MaterialService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaterialService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<MaterialService>(MaterialService);
  });

  // ── createMaterial ──────────────────────────────────────────────────

  describe('createMaterial', () => {
    it('should store image material with file metadata', async () => {
      const created = { id: 'm1', name: 'banner.png' };
      mockPrisma.material.create.mockImplementation(async ({ data }: any) => ({
        id: 'm1', ...data,
      }));

      const result = await service.createMaterial('t1', {
        type: 'image',
        name: 'banner.png',
        url: 'https://oss.local/banner.png',
        thumbUrl: 'https://oss.local/banner-thumb.png',
        fileSize: 102400,
        width: 1920,
        height: 1080,
        format: 'png',
        category: 'banner',
        tags: ['homepage', 'hero'],
      });

      expect(result.type).toBe('image');
      expect(result.url).toBe('https://oss.local/banner.png');
      expect(result.fileSize).toBe(102400);
      expect(result.width).toBe(1920);
      expect(result.height).toBe(1080);
      expect(result.format).toBe('png');
      expect(result.category).toBe('banner');
      expect(result.tags).toEqual(['homepage', 'hero']);

      const call = mockPrisma.material.create.mock.calls[0][0];
      // 租户隔离: tenantId 必传
      expect(call.data.tenantId).toBe('t1');
    });

    it('should default category to uncategorized and tags to []', async () => {
      mockPrisma.material.create.mockImplementation(async ({ data }: any) => ({
        id: 'm2', ...data,
      }));

      const result = await service.createMaterial('t1', {
        type: 'image', name: 'a.png', url: 'https://oss/a.png',
      });

      expect(result.category).toBe('uncategorized');
      expect(result.tags).toEqual([]);
    });
  });

  // ── getMaterials 租户隔离 ────────────────────────────────────────────

  describe('getMaterials (tenant isolation)', () => {
    it('should filter by tenantId and exclude deletedAt', async () => {
      mockPrisma.material.findMany.mockResolvedValue([{ id: 'm1', tenantId: 't1' }]);
      mockPrisma.material.count.mockResolvedValue(1);

      const result = await service.getMaterials('t1', { page: 1, page_size: 10 });

      expect(result.list).toHaveLength(1);
      const findCall = mockPrisma.material.findMany.mock.calls[0][0];
      // 租户隔离: tenantId 必带, deletedAt:null 排除软删
      expect(findCall.where.tenantId).toBe('t1');
      expect(findCall.where.deletedAt).toBeNull();
      expect(findCall.skip).toBe(0);
      expect(findCall.take).toBe(10);
    });

    it('should add type filter and tags hasSome when provided', async () => {
      mockPrisma.material.findMany.mockResolvedValue([]);
      mockPrisma.material.count.mockResolvedValue(0);

      await service.getMaterials('t1', {
        page: 1, page_size: 10,
        type: 'video', tags: ['promo', '2026'],
      });

      const findCall = mockPrisma.material.findMany.mock.calls[0][0];
      expect(findCall.where.type).toBe('video');
      expect(findCall.where.tags).toEqual({ hasSome: ['promo', '2026'] });
    });
  });

  // ── deleteMaterial 软删 + 越权防护 ──────────────────────────────────

  describe('deleteMaterial (soft delete + cross-tenant guard)', () => {
    it('should throw NotFoundException when material not in tenant', async () => {
      mockPrisma.material.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteMaterial('m-of-tenant-B', 'tenant-A'),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.material.update).not.toHaveBeenCalled();
    });

    it('should set deletedAt and return deleted:true', async () => {
      mockPrisma.material.findFirst.mockResolvedValue({
        id: 'm1', tenantId: 't1', name: 'banner.png',
      });
      mockPrisma.material.update.mockResolvedValue({});

      const result = await service.deleteMaterial('m1', 't1');

      expect(result).toEqual({ deleted: true });
      // 软删: 必传 deletedAt
      expect(mockPrisma.material.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });

  // ── recordUsage ─────────────────────────────────────────────────────

  describe('recordUsage', () => {
    it('should create usage log and increment usageCount', async () => {
      mockPrisma.materialUsageLog.create.mockResolvedValue({});
      mockPrisma.material.update.mockResolvedValue({});

      await service.recordUsage('m1', 'broadcast:bc1', 'user-1');

      expect(mockPrisma.materialUsageLog.create).toHaveBeenCalledWith({
        data: { materialId: 'm1', usedIn: 'broadcast:bc1', usedById: 'user-1' },
      });
      // 原子自增 usageCount
      expect(mockPrisma.material.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: { usageCount: { increment: 1 } },
      });
    });
  });
});
