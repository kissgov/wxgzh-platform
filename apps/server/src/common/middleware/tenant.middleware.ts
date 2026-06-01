// 租户中间件 — 从 JWT 提取 tenantId 注入到 AsyncLocalStorage
// ============================================================================
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AsyncLocalStorage } from 'async_hooks';

export const tenantContext = new AsyncLocalStorage<{ tenantId: string }>();

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    // JwtAuthGuard 验证通过后，会将 user 挂到 request 上
    const tenantId = (req as any).user?.tenantId || 'default';
    tenantContext.run({ tenantId }, () => next());
  }
}

/** 获取当前请求上下文的 tenantId */
export function getCurrentTenantId(): string {
  return tenantContext.getStore()?.tenantId || 'default';
}
