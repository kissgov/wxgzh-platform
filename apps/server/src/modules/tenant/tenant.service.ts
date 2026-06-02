// TenantService — 租户内用户/角色/订阅管理
// ============================================================================
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { RESOURCE_LABELS } from '@wxgzh/shared';

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── 租户列表 ────────────────────────────────────────────────────────

  async getTenants() {
    return this.prisma.tenant.findMany({
      where: { status: 'active', deletedAt: null },
      select: { id: true, name: true, slug: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ── 用户管理 ────────────────────────────────────────────────────────

  async getUsers(tenantId: string) {
    const users = await this.prisma.user.findMany({
      where: { tenantId, deletedAt: null },
      select: {
        id: true, name: true, email: true, status: true,
        createdAt: true, lastLoginAt: true,
        userRoles: { include: { role: { select: { id: true, name: true, slug: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 批量获取用户-公众号分配
    const userIds = users.map((u: any) => u.id);
    const assignments = userIds.length ? await this.prisma.userAuthorizer.findMany({
      where: { userId: { in: userIds } },
      include: { authorizer: { select: { id: true, nickName: true } } },
    }) : [];

    const authMap: Record<string, Array<{ id: string; name: string }>> = {};
    for (const a of assignments) {
      if (!authMap[a.userId]) authMap[a.userId] = [];
      authMap[a.userId]!.push({ id: a.authorizerId, name: a.authorizer.nickName });
    }

    return users.map((u: any) => ({
      ...u,
      roles: u.userRoles.map((ur: any) => ur.role),
      userRoles: undefined,
      authorizers: authMap[u.id] || [],
    }));
  }

  async createUser(
    tenantId: string,
    dto: { name: string; email: string; password: string; roleIds?: string[]; authorizerIds?: string[] },
  ) {
    const exist = await this.prisma.user.findFirst({ where: { email: dto.email } });
    if (exist) throw new Error('该邮箱已被使用');

    // 检查用户数限制
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const userCount = await this.prisma.user.count({ where: { tenantId, deletedAt: null } });
    if (tenant?.maxUsers && userCount >= tenant.maxUsers) {
      throw new Error(`已达用户上限（${tenant.maxUsers}），请升级套餐`);
    }

    const user = await this.prisma.user.create({
      data: {
        tenantId,
        name: dto.name,
        email: dto.email,
        passwordHash: await bcrypt.hash(dto.password, 12),
        status: 'active',
      },
    });

    if (dto.roleIds?.length) {
      for (const roleId of dto.roleIds) {
        await this.prisma.userRole.create({ data: { userId: user.id, roleId } });
      }
    }

    if (dto.authorizerIds?.length) {
      for (const aid of dto.authorizerIds) {
        await this.prisma.userAuthorizer.create({
          data: { tenantId, userId: user.id, authorizerId: aid },
        });
      }
    }

    return { id: user.id, name: user.name, email: user.email };
  }

  async updateUser(
    userId: string,
    dto: { name?: string; status?: string; roleIds?: string[]; authorizerIds?: string[] },
  ) {
    if (dto.name) {
      await this.prisma.user.update({ where: { id: userId, tenantId }, data: { name: dto.name } });
    }
    if (dto.status) {
      await this.prisma.user.update({ where: { id: userId, tenantId }, data: { status: dto.status } });
    }
    if (dto.roleIds) {
      await this.prisma.userRole.deleteMany({ where: { userId, user: { tenantId } } });
      for (const roleId of dto.roleIds) {
        await this.prisma.userRole.create({ data: { userId, roleId } });
      }
    }
    if (dto.authorizerIds) {
      // 获取该用户的 tenantId
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { tenantId: true } });
      if (user) {
        await this.prisma.userAuthorizer.deleteMany({ where: { userId, user: { tenantId } } });
        for (const aid of dto.authorizerIds) {
          await this.prisma.userAuthorizer.create({
            data: { tenantId: user.tenantId, userId, authorizerId: aid },
          });
        }
      }
    }
  }

  // ── 角色管理 ────────────────────────────────────────────────────────

  async getRoles(tenantId: string) {
    const roles = await this.prisma.role.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        rolePermissions: { include: { permission: { select: { id: true, slug: true, name: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return roles.map((r: any) => ({
      id: r.id, name: r.name, slug: r.slug, isSystem: r.isSystem, isDefault: r.isDefault,
      permissions: r.rolePermissions.map((rp: any) => rp.permission),
    }));
  }

  async createRole(tenantId: string, dto: { name: string; slug: string; permissionIds?: string[] }) {
    const role = await this.prisma.role.create({
      data: { tenantId, name: dto.name, slug: dto.slug, isSystem: false },
    });
    if (dto.permissionIds?.length) {
      for (const pid of dto.permissionIds) {
        await this.prisma.rolePermission.create({ data: { roleId: role.id, permissionId: pid } });
      }
    }
    return role;
  }

  async updateRole(roleId: string, dto: { name?: string; permissionIds?: string[] }) {
    if (dto.name) {
      await this.prisma.role.update({ where: { id: roleId }, data: { name: dto.name } });
    }
    if (dto.permissionIds) {
      await this.prisma.rolePermission.deleteMany({ where: { roleId } });
      for (const pid of dto.permissionIds) {
        await this.prisma.rolePermission.create({ data: { roleId, permissionId: pid } });
      }
    }
  }

  async deleteRole(roleId: string) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (role?.isSystem) throw new Error('系统角色不可删除');
    await this.prisma.role.update({ where: { id: roleId }, data: { deletedAt: new Date() } });
  }

  // ── 用户可管理的公众号 ──────────────────────────────────────────────

  async getUserAuthorizers(userId: string | null, roles: string[] = []) {
    if (!userId) return [];

    if (roles.includes('super_admin') || roles.includes('admin')) {
      return this.prisma.authorizer.findMany({
        where: { status: 'authorized', deletedAt: null },
        select: { id: true, nickName: true, headImg: true, appType: true },
      });
    }

    const rows = await this.prisma.userAuthorizer.findMany({
      where: { userId },
      include: {
        authorizer: {
          select: { id: true, nickName: true, headImg: true, appType: true },
        },
      },
    });
    return rows
      .map((r: any) => r.authorizer)
      .filter((a: any) => a !== null);
  }

  // ── 权限列表 ────────────────────────────────────────────────────────

  async getPermissions() {
    const permissions = await this.prisma.permission.findMany({
      orderBy: { slug: 'asc' },
    });
    const grouped: Record<string, Array<{ id: string; slug: string; name: string; action: string }>> = {};
    for (const p of permissions) {
      const label = RESOURCE_LABELS[p.resource] || p.resource;
      if (!grouped[label]) grouped[label] = [];
      grouped[label]!.push({ id: p.id, slug: p.slug, name: p.name, action: p.action });
    }
    return grouped;
  }

  // ── 订阅相关 ────────────────────────────────────────────────────────

  async getSubscription(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        plan: true, billingPeriod: true, subscriptionExpiresAt: true,
        trialEndsAt: true, maxAuthorizers: true, maxUsers: true,
      },
    });
    if (!tenant) return null;

    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { slug: tenant.plan || 'free' },
    });

    const records = await this.prisma.subscriptionRecord.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      plan: tenant.plan || 'free',
      planName: plan?.name || '免费版',
      billingPeriod: tenant.billingPeriod || 'trial',
      subscriptionExpiresAt: tenant.subscriptionExpiresAt,
      trialEndsAt: tenant.trialEndsAt,
      maxAuthorizers: tenant.maxAuthorizers || 2,
      maxUsers: tenant.maxUsers || 5,
      records,
    };
  }

  async getPlans() {
    return this.prisma.subscriptionPlan.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }
}
