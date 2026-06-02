// RateLimitGuard + @RateLimit 装饰器
// ============================================================================
// 用法:
//   @RateLimit(5, 60_000, 'ip')          // 5 次/分钟/IP
//   @RateLimit(100, 60_000, 'tenant')     // 100 次/分钟/租户
//   @RateLimit(10, 1000, 'route')         // 10 次/秒/路由
// ============================================================================
import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SlidingWindowLimiter } from './sliding-window';

export type RateLimitScope = 'tenant' | 'ip' | 'route';

export interface RateLimitConfig {
  limit: number;
  windowMs: number;
  scope: RateLimitScope;
}

export const RATE_LIMIT_KEY = 'rate:limit';

/**
 * 标记方法需要限流。
 * @param limit 时间窗内最大请求数
 * @param windowMs 时间窗长度 (ms)
 * @param scope 限流 key 维度
 */
export const RateLimit = (
  limit: number,
  windowMs: number,
  scope: RateLimitScope = 'route',
) => SetMetadata(RATE_LIMIT_KEY, { limit, windowMs, scope });

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly limiter: SlidingWindowLimiter,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const cfg = this.reflector.getAllAndOverride<RateLimitConfig>(RATE_LIMIT_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!cfg) return true;

    const req = ctx.switchToHttp().getRequest();
    const key = this.buildKey(req, cfg.scope, ctx);

    const result = await this.limiter.check(key, cfg.limit, cfg.windowMs);
    if (!result.allowed) {
      throw new HttpException(
        {
          code: 10006,
          message: '请求频率超限',
          retryAfterMs: result.resetMs,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }

  private buildKey(req: any, scope: RateLimitScope, ctx: ExecutionContext): string {
    const routePath = ctx.getHandler().name || req.route?.path || req.url || 'unknown';
    if (scope === 'tenant') {
      const tenantId = req.user?.tenantId || 'anonymous';
      return `rl:tenant:${tenantId}:${routePath}`;
    }
    if (scope === 'ip') {
      const ip = req.ip || req.socket?.remoteAddress || 'unknown';
      return `rl:ip:${ip}:${routePath}`;
    }
    return `rl:route:${routePath}`;
  }
}
