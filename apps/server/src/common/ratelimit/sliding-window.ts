// SlidingWindowLimiter — Redis 精确滑动窗口限流
// ============================================================================
// 与 @nestjs/throttler 互补: throttler 用固定窗口 (ttl+limit), 本类用滑动窗口
// (精确计算 N 秒内请求数, 避免固定窗口边界 burst)。
//
// 算法 (ZSET):
//   - 每个请求 zadd 到 key, score = timestamp
//   - 检查前先 zremrangebyscore 移除 [0, now-windowMs] 范围
//   - zcard 获取当前窗口内请求数
// ============================================================================
import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import Redis from 'ioredis';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
  count: number;
}

@Injectable()
export class SlidingWindowLimiter implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SlidingWindowLimiter.name);
  private redis!: Redis;

  async onModuleInit(): Promise<void> {
    const url = process.env['REDIS_URL'] || 'redis://localhost:6379';
    this.redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    });
    this.redis.on('error', (e) => this.logger.error(`Redis error: ${e.message}`));
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis) await this.redis.quit();
  }

  /**
   * 检查并记录一次请求。
   * @param key 限流 key (如 `rl:login:1.2.3.4`)
   * @param limit 时间窗内最大请求数
   * @param windowMs 时间窗长度 (ms)
   */
  async check(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    if (!this.redis) {
      // Redis 不可用: fail-open (避免限流器自身故障导致业务不可用)
      this.logger.warn('Redis 未连接, fail-open 放行');
      return { allowed: true, remaining: limit, resetMs: windowMs, count: 0 };
    }

    const now = Date.now();
    const windowStart = now - windowMs;
    const member = `${now}-${Math.random().toString(36).slice(2, 8)}`;

    const multi = this.redis.multi();
    multi.zremrangebyscore(key, 0, windowStart);
    multi.zadd(key, now, member);
    multi.zcard(key);
    multi.pexpire(key, windowMs);
    const res = await multi.exec();

    if (!res) {
      return { allowed: true, remaining: limit, resetMs: windowMs, count: 0 };
    }

    const count = Number((res[2]?.[1] as number) || 0);
    const allowed = count <= limit;
    return {
      allowed,
      remaining: Math.max(0, limit - count),
      resetMs: windowMs,
      count,
    };
  }
}
