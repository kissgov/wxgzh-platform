// PermissionGuard — 升级版, 集成 PERMISSIONS 常量 + 多权限 AND 语义
// ============================================================================
// 优先级:
//   1. @Public()       → 放行
//   2. @RequireRole(s) → 角色匹配 (委托 V1 RolesGuard)
//   3. @RequirePermission (S4 新版)  → 权限 AND 检查
//   4. 无装饰器       → 放行 (Sprint 2 收紧)
// ============================================================================
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  IS_PUBLIC_KEY,
} from '../decorators/current-user.decorator';
import { REQUIRE_PERMISSION_KEY } from './require-permission.decorator';
import type { Permission } from './permissions';

export interface RequestUser {
  sub: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
}

@Injectable()
export class PermissionGuard implements CanActivate {
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

    if (!user) {
      throw new ForbiddenException({ code: 10003, message: '未认证或 Token 已过期' });
    }

    // super_admin 拥有全部权限
    if (user.roles?.includes('super_admin')) {
      return true;
    }

    // 读取 S4 @RequirePermission 元数据
    const required = this.reflector.getAllAndOverride<readonly Permission[]>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) {
      // 无装饰器 → 放行 (与 V1 保持兼容, 后续 sprint 收紧)
      return true;
    }

    const has = required.every((p) => user.permissions?.includes(p));
    if (!has) {
      throw new ForbiddenException({
        code: 10003,
        message: `无权限: 需要 ${required.join(', ')}`,
        required,
      });
    }
    return true;
  }
}
