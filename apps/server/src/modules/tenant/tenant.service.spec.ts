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

    it('should return mapped authorizer rows for non-admin (scoped via userAuthorizer)', async () => {
      mockPrisma.userAuthorizer.findMany.mockResolvedValue([
        { authorizer: { id: 'a1', nickName: 'MP1', headImg: '', appType: 2 } },
        { authorizer: { id: 'a2', nickName: 'MP2', headImg: '', appType: 2 } },
        { authorizer: null },                              // 过滤 null
      ]);

      const result = await service.getUserAuthorizers('u-normal', ['editor']);

      expect(result).toEqual([
        { id: 'a1', nickName: 'MP1', headImg: '', appType: 2 },
        { id: 'a2', nickName: 'MP2', headImg: '', appType: 2 },
      ]);
      // findMany 必须以 userId 过滤
      expect(mockPrisma.userAuthorizer.findMany.mock.calls[0][0].where.userId).toBe('u-normal');
    });

    it('super_admin should bypass userAuthorizer scope', async () => {
      mockPrisma.authorizer.findMany.mockResolvedValue([{ id: 'a1', nickName: 'X', headImg: '', appType: 1 }]);
      await service.getUserAuthorizers('u-super', ['super_admin']);
      expect(mockPrisma.authorizer.findMany).toHaveBeenCalled();
      expect(mockPrisma.userAuthorizer.findMany).not.toHaveBeenCalled();
    });
  });

  // ── getUsers ────────────────────────────────────────────────────────

  describe('getUsers', () => {
    it('should return users with flattened roles and authorizers list', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: 'u1', name: 'Alice', email: 'a@x', status: 'active',
          createdAt: new Date(), lastLoginAt: null,
          userRoles: [{ role: { id: 'r1', name: 'Owner', slug: 'owner' } }],
        },
      ]);
      mockPrisma.userAuthorizer.findMany.mockResolvedValue([
        { userId: 'u1', authorizerId: 'auth-1', authorizer: { id: 'auth-1', nickName: 'MP' } },
      ]);

      const result = await service.getUsers('t1');
      expect(result[0].roles).toEqual([{ id: 'r1', name: 'Owner', slug: 'owner' }]);
      expect(result[0].userRoles).toBeUndefined();
      expect(result[0].authorizers).toEqual([{ id: 'auth-1', name: 'MP' }]);
    });

    it('should skip userAuthorizer query when no users returned', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      const result = await service.getUsers('t1');
      expect(result).toEqual([]);
      expect(mockPrisma.userAuthorizer.findMany).not.toHaveBeenCalled();
    });
  });

  // ── createUser 角色/公众号分配 ──────────────────────────────────────

  describe('createUser (with roles and authorizers)', () => {
    it('should create userRole and userAuthorizer rows when provided', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.tenant.findUnique.mockResolvedValue({ maxUsers: 100 });
      mockPrisma.user.count.mockResolvedValue(0);
      mockPrisma.user.create.mockResolvedValue({ id: 'u1' });

      await service.createUser('t1', {
        name: 'A', email: 'a@x', password: 'p',
        roleIds: ['r1', 'r2'], authorizerIds: ['auth-1'],
      });

      expect(mockPrisma.userRole.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.userAuthorizer.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { tenantId: 't1', userId: 'u1', authorizerId: 'auth-1' } }),
      );
    });
  });

  // ── updateUser ──────────────────────────────────────────────────────

  describe('updateUser', () => {
    it('should update name + status when only those provided', async () => {
      await service.updateUser('u1', { name: 'New', status: 'inactive' });
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'u1' }, data: { name: 'New' } }),
      );
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'u1' }, data: { status: 'inactive' } }),
      );
    });

    it('should reset userRole rows when roleIds provided', async () => {
      await service.updateUser('u1', { roleIds: ['r1'] });
      expect(mockPrisma.userRole.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'u1' } }),
      );
      expect(mockPrisma.userRole.create).toHaveBeenCalled();
    });

    it('should rewrite userAuthorizer rows scoped to user tenant', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ tenantId: 't1' });
      await service.updateUser('u1', { authorizerIds: ['a1', 'a2'] });
      expect(mockPrisma.userAuthorizer.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'u1' } }),
      );
      expect(mockPrisma.userAuthorizer.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.userAuthorizer.create.mock.calls[0][0].data.tenantId).toBe('t1');
    });

    it('should skip userAuthorizer update when user missing', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await service.updateUser('u-missing', { authorizerIds: ['a1'] });
      expect(mockPrisma.userAuthorizer.create).not.toHaveBeenCalled();
    });
  });

  // ── 角色管理 ──────────────────────────────────────────────────────────

  describe('role management', () => {
    it('getRoles should map rolePermissions → permissions', async () => {
      mockPrisma.role.findMany.mockResolvedValue([
        {
          id: 'r1', name: 'Owner', slug: 'owner', isSystem: true, isDefault: false,
          rolePermissions: [{ permission: { id: 'p1', slug: 'user.read', name: '读用户' } }],
        },
      ]);
      const r = await service.getRoles('t1');
      expect(r[0]!.permissions).toEqual([{ id: 'p1', slug: 'user.read', name: '读用户' }]);
    });

    it('createRole should create + bind permissions', async () => {
      mockPrisma.role.create.mockResolvedValue({ id: 'r-new' });
      await service.createRole('t1', { name: 'R', slug: 'r', permissionIds: ['p1', 'p2'] });
      expect(mockPrisma.role.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isSystem: false }) }),
      );
      expect(mockPrisma.rolePermission.create).toHaveBeenCalledTimes(2);
    });

    it('createRole should not bind permissions when none provided', async () => {
      mockPrisma.role.create.mockResolvedValue({ id: 'r' });
      await service.createRole('t1', { name: 'R', slug: 'r' });
      expect(mockPrisma.rolePermission.create).not.toHaveBeenCalled();
    });

    it('updateRole should patch name and reset permission bindings', async () => {
      await service.updateRole('r1', { name: 'New', permissionIds: ['p1'] });
      expect(mockPrisma.role.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'r1' }, data: { name: 'New' } }),
      );
      expect(mockPrisma.rolePermission.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { roleId: 'r1' } }),
      );
      expect(mockPrisma.rolePermission.create).toHaveBeenCalled();
    });

    it('updateRole should skip patch when name missing', async () => {
      await service.updateRole('r1', { permissionIds: ['p1'] });
      expect(mockPrisma.role.update).not.toHaveBeenCalled();
    });
  });

  // ── 权限分组 ──────────────────────────────────────────────────────────

  describe('getPermissions', () => {
    it('should group permissions by resource label (fallback to resource slug when label missing)', async () => {
      // 顶层 mock @wxgzh/shared 把 RESOURCE_LABELS 设为空对象, 走 fallback
      mockPrisma.permission.findMany.mockResolvedValue([
        { id: 'p1', slug: 'user.read', name: '读', action: 'read', resource: 'user' },
        { id: 'p2', slug: 'user.write', name: '写', action: 'write', resource: 'user' },
        { id: 'p3', slug: 'content.read', name: '读', action: 'read', resource: 'content' },
      ]);

      const grouped = await service.getPermissions();
      // RESOURCE_LABELS 为空, 走 fallback → resource 名本身当 key
      expect(Object.keys(grouped).sort()).toEqual(['content', 'user']);
      expect(grouped['user']).toHaveLength(2);
      expect(grouped['content']).toHaveLength(1);
    });
  });

  // ── getSubscription / getPlans ───────────────────────────────────────

  describe('getSubscription + getPlans', () => {
    it('should default planName and period to 免费/trial when plan missing', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({ plan: null });
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(null);
      mockPrisma.subscriptionRecord.findMany.mockResolvedValue([]);
      const r = await service.getSubscription('t1');
      expect(r?.plan).toBe('free');
      expect(r?.planName).toBe('免费版');
      expect(r?.billingPeriod).toBe('trial');
    });

    it('getPlans should return plans sorted by sortOrder', async () => {
      mockPrisma.subscriptionPlan.findMany.mockResolvedValue([]);
      await service.getPlans();
      expect(mockPrisma.subscriptionPlan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { sortOrder: 'asc' } }),
      );
    });
  });
});
