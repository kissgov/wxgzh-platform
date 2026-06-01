// TenantService 单元测试 — 核心用户/角色/订阅管理
// ============================================================================
// @wxgzh/shared 用 moduleNameMapper 解析但 ts-jest 类型检查仍找不到，
// 在 spec 顶层 mock 掉 (该模块只暴露 RESOURCE_LABELS 常量, 不影响被测代码)。
jest.mock('@wxgzh/shared', () => ({ RESOURCE_LABELS: {} }), { virtual: true });

import { Test, TestingModule } from '@nestjs/testing';
import { TenantService } from './tenant.service';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

// Mock Prisma (完整覆盖 TenantService 用到的 model)
const mockPrisma: any = {
  tenant: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
  },
  user: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  userRole: { create: jest.fn(), deleteMany: jest.fn() },
  userAuthorizer: { create: jest.fn(), deleteMany: jest.fn(), findMany: jest.fn() },
  role: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  rolePermission: { create: jest.fn(), deleteMany: jest.fn() },
  authorizer: { findMany: jest.fn() },
  permission: { findMany: jest.fn() },
  subscriptionPlan: { findUnique: jest.fn(), findMany: jest.fn() },
  subscriptionRecord: { findMany: jest.fn() },
};

describe('TenantService', () => {
  let service: TenantService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<TenantService>(TenantService);
  });

  // ── getTenants ─────────────────────────────────────────────────────

  describe('getTenants', () => {
    it('should return active non-deleted tenants sorted by createdAt', async () => {
      const rows = [
        { id: 't1', name: 'Alpha', slug: 'alpha' },
        { id: 't2', name: 'Beta', slug: 'beta' },
      ];
      mockPrisma.tenant.findMany.mockResolvedValue(rows);

      const result = await service.getTenants();

      expect(result).toEqual(rows);
      expect(mockPrisma.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'active', deletedAt: null },
        }),
      );
    });
  });

  // ── createUser ─────────────────────────────────────────────────────

  describe('createUser', () => {
    it('should throw when email already exists', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'u-existing' });

      await expect(
        service.createUser('t1', {
          name: 'Alice', email: 'dup@test.local', password: 'pw',
        }),
      ).rejects.toThrow(/该邮箱已被使用/);
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('should throw when tenant maxUsers reached', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: 't1', maxUsers: 1 });
      mockPrisma.user.count.mockResolvedValue(1); // already at cap

      await expect(
        service.createUser('t1', {
          name: 'Alice', email: 'new@test.local', password: 'pw',
        }),
      ).rejects.toThrow(/已达用户上限/);
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('should hash password and create user with active status', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: 't1', maxUsers: 100 });
      mockPrisma.user.count.mockResolvedValue(0);
      mockPrisma.user.create.mockImplementation(async ({ data }: any) => ({
        id: 'u-new',
        tenantId: data.tenantId,
        name: data.name,
        email: data.email,
        passwordHash: data.passwordHash,
        status: data.status,
      }));

      const result = await service.createUser('t1', {
        name: 'Alice', email: 'alice@test.local', password: 'plain-pw',
      });

      expect(result.id).toBe('u-new');
      expect(result.email).toBe('alice@test.local');
      // 密码已 bcrypt 哈希,不等于明文 (从 create 调用里取 hash)
      const createCall = mockPrisma.user.create.mock.calls[0][0];
      const hashed = createCall.data.passwordHash as string;
      expect(hashed).toBeDefined();
      expect(hashed).not.toBe('plain-pw');
      // hash 可被 bcrypt 验证
      const matches = await bcrypt.compare('plain-pw', hashed);
      expect(matches).toBe(true);
      // 状态设为 active
      expect(createCall.data.status).toBe('active');
    });
  });

  // ── getSubscription ────────────────────────────────────────────────

  describe('getSubscription', () => {
    it('should return plan + maxAuthorizers (default 2 for free plan)', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        plan: 'free',
        billingPeriod: 'trial',
        subscriptionExpiresAt: null,
        trialEndsAt: null,
        maxAuthorizers: 2,
        maxUsers: 5,
      });
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue({
        slug: 'free', name: '免费版',
      });
      mockPrisma.subscriptionRecord.findMany.mockResolvedValue([]);

      const result = await service.getSubscription('t1');

      expect(result?.plan).toBe('free');
      expect(result?.maxAuthorizers).toBe(2);
      expect(result?.maxUsers).toBe(5);
      expect(result?.planName).toBe('免费版');
    });

    it('should return null when tenant not found', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      const result = await service.getSubscription('missing');

      expect(result).toBeNull();
    });
  });

  // ── deleteRole ─────────────────────────────────────────────────────

  describe('deleteRole', () => {
    it('should throw when deleting system role', async () => {
      mockPrisma.role.findUnique.mockResolvedValue({ id: 'r1', isSystem: true });

      await expect(service.deleteRole('r1')).rejects.toThrow(/系统角色不可删除/);
      expect(mockPrisma.role.update).not.toHaveBeenCalled();
    });

    it('should soft delete non-system role by setting deletedAt', async () => {
      mockPrisma.role.findUnique.mockResolvedValue({ id: 'r1', isSystem: false });
      mockPrisma.role.update.mockResolvedValue({});

      await service.deleteRole('r1');

      expect(mockPrisma.role.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });

  // ── getUserAuthorizers 越权防护 ────────────────────────────────────

  describe('getUserAuthorizers', () => {
    it('should return [] when userId is null', async () => {
      const result = await service.getUserAuthorizers(null, []);
      expect(result).toEqual([]);
      expect(mockPrisma.userAuthorizer.findMany).not.toHaveBeenCalled();
    });

    it('should return all authorized authorizers for admin role', async () => {
      const authRows = [
        { id: 'a1', nickName: 'MP1', headImg: '', appType: 2 },
        { id: 'a2', nickName: 'MP2', headImg: '', appType: 2 },
      ];
      mockPrisma.authorizer.findMany.mockResolvedValue(authRows);

      const result = await service.getUserAuthorizers('u-admin', ['admin']);

      expect(result).toEqual(authRows);
      // admin 不应走 userAuthorizer 关联查询
      expect(mockPrisma.userAuthorizer.findMany).not.toHaveBeenCalled();
    });
  });
});
