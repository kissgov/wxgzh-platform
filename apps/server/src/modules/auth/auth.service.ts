// AuthService — 认证业务逻辑
// ============================================================================
import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  // ── 登录 ────────────────────────────────────────────────────────────

  async login(email: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, status: 'active' },
      include: {
        userRoles: {
          include: {
            role: { include: { rolePermissions: { include: { permission: true } } } },
          },
        },
      },
    });

    if (!user) throw new UnauthorizedException('邮箱或密码错误');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('邮箱或密码错误');

    const roles: string[] = user.userRoles.map((ur: any) => ur.role.slug);
    const permissions: string[] = Array.from(
      new Set(
        user.userRoles.flatMap((ur: any) =>
          ur.role.rolePermissions.map((rp: any) => rp.permission.slug),
        ),
      ),
    );

    const payload = { sub: user.id, tenantId: user.tenantId, roles, permissions };
    const accessToken = this.jwtService.sign(payload);

    // Refresh Token 轮转：生成带唯一 jti 的 refresh token
    const refreshToken = this.generateRefreshToken(payload);

    // 更新最后登录时间
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tenant = await this.prisma.tenant.findUnique({ where: { id: user.tenantId } });

    this.logger.log(`User login: ${user.email} (tenant=${user.tenantId})`);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 7200,
      user: {
        id: user.id, name: user.name, email: user.email,
        avatar: user.avatar, roles, permissions,
      },
      tenant: tenant ? { id: tenant.id, name: tenant.name, slug: tenant.slug } : null,
    };
  }

  // ── 注册 ────────────────────────────────────────────────────────────

  async register(dto: { name: string; email: string; password: string; company: string }) {
    if (!dto.name || !dto.email || !dto.password) {
      throw new UnauthorizedException('请填写完整的注册信息');
    }
    if (dto.password.length < 6) {
      throw new UnauthorizedException('密码至少 6 位');
    }

    const existing = await this.prisma.user.findFirst({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('该邮箱已被注册');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await this.prisma.$transaction(async (tx: any) => {
      const slug = dto.company
        ? dto.company.replace(/[^a-zA-Z0-9一-鿿]/g, '').substring(0, 20).toLowerCase() || `tenant_${Date.now()}`
        : `tenant_${Date.now()}`;

      const trialDays = 14;
      const trialEndsAt = new Date(Date.now() + trialDays * 86400000);

      const tenant = await tx.tenant.create({
        data: {
          name: dto.company || dto.name + '的团队',
          slug,
          contact: dto.name,
          status: 'active',
          plan: 'free',
          billingPeriod: 'trial',
          maxAuthorizers: 2,
          maxUsers: 5,
          trialEndsAt,
        },
      });

      const role = await tx.role.create({
        data: {
          tenantId: tenant.id,
          name: '管理员',
          slug: 'admin',
          isSystem: false,
          isDefault: true,
        },
      });

      const passwordHash = await bcrypt.hash(dto.password, 12);
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: dto.email,
          passwordHash,
          name: dto.name,
          status: 'active',
        },
      });

      await tx.userRole.create({
        data: { userId: user.id, roleId: role.id },
      });

      return { tenant, user, role };
    });

    const payload = {
      sub: result.user.id,
      tenantId: result.tenant.id,
      roles: ['admin'],
      permissions: [],
    };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.generateRefreshToken(payload);

    this.logger.log(`User registered: ${dto.email} (tenant=${result.tenant.id})`);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 7200,
      user: {
        id: result.user.id, name: result.user.name, email: result.user.email,
        avatar: null, roles: ['admin'], permissions: [],
      },
      tenant: {
        id: result.tenant.id, name: result.tenant.name, slug: result.tenant.slug,
      },
    };
  }

  // ── Token 刷新（带轮转） ────────────────────────────────────────────

  async refreshToken(refreshTokenStr: string) {
    try {
      const payload = this.jwtService.verify<{
        sub: string; tenantId: string; roles: string[];
        permissions: string[]; jti: string;
      }>(refreshTokenStr);

      // 生成新的 access token
      const accessToken = this.jwtService.sign({
        sub: payload.sub, tenantId: payload.tenantId,
        roles: payload.roles, permissions: payload.permissions,
      });

      // Token 轮转：颁发新的 refresh token（旧 token 的 jti 可放入黑名单）
      const newRefreshToken = this.generateRefreshToken({
        sub: payload.sub, tenantId: payload.tenantId,
        roles: payload.roles, permissions: payload.permissions,
      });

      return {
        access_token: accessToken,
        refresh_token: newRefreshToken,
        expires_in: 7200,
      };
    } catch {
      throw new UnauthorizedException('Refresh Token 无效或已过期');
    }
  }

  // ── 个人信息 ────────────────────────────────────────────────────────

  async updateProfile(
    userId: string,
    dto: { name?: string; oldPassword?: string; newPassword?: string },
  ) {
    if (!userId) throw new UnauthorizedException('未认证');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('用户不存在');

    if (dto.oldPassword && dto.newPassword) {
      const valid = await bcrypt.compare(dto.oldPassword, user.passwordHash);
      if (!valid) throw new UnauthorizedException('原密码错误');
      if (dto.newPassword.length < 6) throw new UnauthorizedException('新密码至少 6 位');
      await this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash: await bcrypt.hash(dto.newPassword, 12) },
      });
    }

    if (dto.name) {
      await this.prisma.user.update({ where: { id: userId }, data: { name: dto.name } });
    }

    const updated = await this.prisma.user.findUnique({ where: { id: userId } });
    return {
      id: updated!.id, name: updated!.name,
      email: updated!.email, avatar: updated!.avatar,
    };
  }

  // ── 内部辅助 ────────────────────────────────────────────────────────

  /** 生成带 jti 的 refresh token（用于轮转检测） */
  private generateRefreshToken(payload: {
    sub: string; tenantId: string; roles: string[]; permissions: string[];
  }): string {
    return this.jwtService.sign(
      {
        ...payload,
        jti: `${payload.sub}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      },
      { expiresIn: '7d' },
    );
  }
}
