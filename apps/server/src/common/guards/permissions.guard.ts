// PermissionsGuard — 基于权限/角色的访问控制
// 优先级: @RequireRole → @RequirePermission(s) → 无装饰器则放行
// ============================================================================
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  PERMISSION_KEY,
  PERMISSIONS_KEY,
  ROLES_KEY,
  IS_PUBLIC_KEY,
} from '../decorators/current-user.decorator';

export interface RequestUser {
  sub: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 公开接口跳过
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const user: RequestUser | undefined = request.user;

    // 无用户信息（JwtAuthGuard 未通过）→ 拒绝
    if (!user) {
      throw new ForbiddenException({
        code: 10003,
        message: '未认证或 Token 已过期',
      });
    }

    // 超级管理员拥有全部权限
    if (user.roles?.includes('super_admin')) {
      return true;
    }

    // ── 角色检查 ──
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (requiredRoles?.length) {
      const hasRole = requiredRoles.some((role) =>
        user.roles?.includes(role),
      );
      if (!hasRole) {
        throw new ForbiddenException({
          code: 10003,
          message: `需要以下角色之一: ${requiredRoles.join(', ')}`,
        });
      }
      return true; // 角色匹配通过
    }

    // ── 权限检查（单权限） ──
    const requiredPermission = this.reflector.getAllAndOverride<string>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (requiredPermission) {
      const hasPerm = user.permissions?.includes(requiredPermission);
      if (!hasPerm) {
        throw new ForbiddenException({
          code: 10003,
          message: `需要权限: ${requiredPermission}`,
        });
      }
      return true;
    }

    // ── 权限检查（多权限，任一满足） ──
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (requiredPermissions?.length) {
      const hasAny = requiredPermissions.some((perm) =>
        user.permissions?.includes(perm),
      );
      if (!hasAny) {
        throw new ForbiddenException({
          code: 10003,
          message: `需要以下权限之一: ${requiredPermissions.join(', ')}`,
        });
      }
      return true;
    }

    // 无装饰器 → 放行（向后兼容，Sprint 0 逐步添加装饰器后收紧）
    return true;
  }
}
