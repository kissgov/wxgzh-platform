// 多租户限流守卫 — 按 tenantId + IP 分别限流
// ============================================================================
import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { Request } from 'express';

@Injectable()
export class TenantThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    const tenantId = (req as any).user?.tenantId || 'anonymous';
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    return `rate:${tenantId}:${ip}`;
  }
}
