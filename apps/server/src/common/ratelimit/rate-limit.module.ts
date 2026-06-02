// RateLimitModule — 注册 SlidingWindowLimiter 和 RateLimitGuard
// ============================================================================
import { Module, Global } from '@nestjs/common';
import { SlidingWindowLimiter } from './sliding-window';
import { RateLimitGuard } from './rate-limit.guard';

@Global()
@Module({
  providers: [SlidingWindowLimiter, RateLimitGuard],
  exports: [SlidingWindowLimiter, RateLimitGuard],
})
export class RateLimitModule {}
