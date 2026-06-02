// TenantScopeGuard — 强制 tenantId 一致性
// ============================================================================
// 解决 "user.tenantId 与请求参数 tenantId 不一致" 的越权场景。
// 用法:
//   @UseGuards(TenantScopeGuard)  // 自动校验 body/params/query 中的 tenantId
//   或通过 @RequireTenantScope() 装饰器按方法/类启用
// ============================================================================
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RequestUser } from './permission.guard';

export const REQUIRE_TENANT_SCOPE_KEY = 'require:tenantScope';
export const RequireTenantScope = () => SetMetadata(REQUIRE_TENANT_SCOPE_KEY, true);

@Injectable()
export class TenantScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<boolean>(REQUIRE_TENANT_SCOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const request = context.switchToHttp().getRequest();
    const user: RequestUser | undefined = request.user;
    if (!user) {
      throw new ForbiddenException({ code: 10003, message: '未认证' });
    }
    if (user.roles?.includes('super_admin')) return true;

    const userTenantId = user.tenantId;
    if (!userTenantId) {
      throw new ForbiddenException({ code: 10003, message: '租户上下文缺失' });
    }

    // 扫描所有可能位置
    const sources: any[] = [
      request.params,
      request.query,
      request.body,
    ];

    for (const src of sources) {
      if (!src || typeof src !== 'object') continue;
      for (const [key, value] of Object.entries(src)) {
        if (key === 'tenantId' || key === 'tenant_id') {
          if (value && value !== userTenantId) {
            throw new ForbiddenException({
              code: 10003,
              message: 'tenantId 不匹配 (越权访问)',
              field: key,
            });
          }
        }
      }
    }

    return true;
  }
}
