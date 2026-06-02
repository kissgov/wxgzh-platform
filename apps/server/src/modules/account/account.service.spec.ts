// AccountService 单元测试 — 分组 + 越权防护
// ============================================================================
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AccountService } from './account.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrisma: any = {
  authorizer: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  accountGroup: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  accountGroupItem: {
    create: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
  },
};

describe('AccountService', () => {
  let service: AccountService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<AccountService>(AccountService);
  });

  // ── createGroup ────────────────────────────────────────────────────

  describe('createGroup', () => {
    it('should create group with given name and parentId', async () => {
      const created = {
        id: 'g1', tenantId: 't1', name: '品牌号',
        parentId: 'g-parent', sortOrder: 0, deletedAt: null,
      };
      mockPrisma.accountGroup.create.mockResolvedValue(created);

      const result = await service.createGroup('t1', {
        name: '品牌号', parentId: 'g-parent', sortOrder: 0,
      });

      expect(result).toEqual(created);
      expect(mockPrisma.accountGroup.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 't1', name: '品牌号', parentId: 'g-parent',
          }),
        }),
      );
    });

    it('should default sortOrder to 0 when not provided', async () => {
      mockPrisma.accountGroup.create.mockImplementation(async ({ data }: any) => ({
        id: 'g2', ...data, deletedAt: null,
      }));

      await service.createGroup('t1', { name: '默认分组' });

      const call = mockPrisma.accountGroup.create.mock.calls[0][0];
      expect(call.data.sortOrder).toBe(0);
    });
  });

  // ── updateGroup 越权防护 ───────────────────────────────────────────

  describe('updateGroup', () => {
    it('should throw NotFoundException when group belongs to other tenant', async () => {
      mockPrisma.accountGroup.findFirst.mockResolvedValue(null);

      await expect(
        service.updateGroup('t1', 'group-of-t2', { name: '新名' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.accountGroup.update).not.toHaveBeenCalled();
    });

    it('should update group when tenant matches', async () => {
      mockPrisma.accountGroup.findFirst.mockResolvedValue({
        id: 'g1', tenantId: 't1', name: '旧名',
      });
      mockPrisma.accountGroup.update.mockResolvedValue({
        id: 'g1', tenantId: 't1', name: '新名',
      });

      const result = await service.updateGroup('t1', 'g1', { name: '新名' });

      expect(result.name).toBe('新名');
      // 越权防护: findFirst 必带 tenantId
      expect(mockPrisma.accountGroup.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'g1', tenantId: 't1' }),
        }),
      );
    });
  });

  // ── addToGroup ─────────────────────────────────────────────────────

  describe('addToGroup', () => {
    it('should throw NotFoundException when group not in tenant', async () => {
      mockPrisma.accountGroup.findFirst.mockResolvedValue(null);

      await expect(
        service.addToGroup('t1', 'g-missing', ['a1']),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.accountGroupItem.create).not.toHaveBeenCalled();
    });

    it('should add authorizers to group and skip duplicates (P2002)', async () => {
      mockPrisma.accountGroup.findFirst.mockResolvedValue({ id: 'g1', tenantId: 't1' });
      // 第一次 create 成功, 第二次抛 P2002 (重复)
      mockPrisma.accountGroupItem.create
        .mockResolvedValueOnce({ groupId: 'g1', authorizerId: 'a1' })
        .mockImplementationOnce(() => {
          const err: any = new Error('Unique constraint');
          err.code = 'P2002';
          throw err;
        });

      const result = await service.addToGroup('t1', 'g1', ['a1', 'a1-dup']);

      expect(result.added).toBe(1);
      expect(mockPrisma.accountGroupItem.create).toHaveBeenCalledTimes(2);
    });

    it('should propagate non-P2002 errors', async () => {
      mockPrisma.accountGroup.findFirst.mockResolvedValue({ id: 'g1', tenantId: 't1' });
      mockPrisma.accountGroupItem.create.mockImplementation(() => {
        const err: any = new Error('DB connection lost');
        err.code = 'P1001';
        throw err;
      });

      await expect(
        service.addToGroup('t1', 'g1', ['a1']),
      ).rejects.toThrow(/DB connection lost/);
    });
  });

  // ── deleteGroup 越权防护 ───────────────────────────────────────────

  describe('deleteGroup', () => {
    it('should throw NotFoundException for cross-tenant delete', async () => {
      mockPrisma.accountGroup.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteGroup('tenant-A', 'group-of-tenant-B'),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.accountGroup.update).not.toHaveBeenCalled();
    });

    it('should soft delete (set deletedAt) on success', async () => {
      mockPrisma.accountGroup.findFirst.mockResolvedValue({ id: 'g1', tenantId: 't1' });
      mockPrisma.accountGroup.update.mockResolvedValue({});

      const result = await service.deleteGroup('t1', 'g1');

      expect(result.deleted).toBe(true);
      expect(mockPrisma.accountGroup.update).toHaveBeenCalledWith({
        where: { id: 'g1', tenantId: 't1' },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });

  // ── getGroupTree ───────────────────────────────────────────────────

  describe('getGroupTree', () => {
    it('should return group list with accountCount, scoped to tenant', async () => {
      mockPrisma.accountGroup.findMany.mockImplementation(async ({ where }: any) => {
        // 验证 where 包含 tenantId
        expect(where.tenantId).toBe('t1');
        return [
          {
            id: 'g1', name: '品牌号', parentId: null, sortOrder: 0, deletedAt: null,
            items: [
              { authorizer: { id: 'a1', nickName: 'MP1', headImg: '', appId: 'wx1' } },
              { authorizer: { id: 'a2', nickName: 'MP2', headImg: '', appId: 'wx2' } },
            ],
          },
          {
            id: 'g2', name: '服务号', parentId: null, sortOrder: 1, deletedAt: null,
            items: [],
          },
        ];
      });

      const result = await service.getGroupTree('t1');

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ id: 'g1', name: '品牌号', accountCount: 2 });
      expect(result[1]).toMatchObject({ id: 'g2', name: '服务号', accountCount: 0 });
    });
  });

  // ── getAccounts 租户隔离 ───────────────────────────────────────────

  describe('getAccounts', () => {
    it('should query authorizer with tenantId filter (tenant isolation)', async () => {
      mockPrisma.authorizer.findMany.mockResolvedValue([]);
      mockPrisma.authorizer.count.mockResolvedValue(0);

      await service.getAccounts('t1', { page: 1, page_size: 20 });

      const findCall = mockPrisma.authorizer.findMany.mock.calls[0][0];
      // 租户隔离: where 必须带 tenantId
      expect(findCall.where.tenantId).toBe('t1');
      // 仅查 authorized 状态
      expect(findCall.where.status).toBe('authorized');
      // 排除已删除
      expect(findCall.where.deletedAt).toBeNull();
    });
  });
});
