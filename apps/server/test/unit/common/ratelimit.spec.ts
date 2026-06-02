// SlidingWindowLimiter 单元测试 (使用 mock Redis)
// ============================================================================
import { SlidingWindowLimiter } from '../../../src/common/ratelimit/sliding-window';

describe('SlidingWindowLimiter', () => {
  // 简单的 mock: 模拟 Redis ZSET
  class MockRedis {
    private store = new Map<string, Array<{ score: number; member: string }>>();

    multi() {
      const ops: Array<{ cmd: string; args: any[] }> = [];
      const exec = async () => {
        const results: any[] = [];
        for (const op of ops) {
          if (op.cmd === 'zremrangebyscore') {
            const [key, , max] = op.args as [string, string, number];
            const arr = this.store.get(key) || [];
            const filtered = arr.filter((e) => e.score > max);
            this.store.set(key, filtered);
            results.push([null, filtered.length]);
          } else if (op.cmd === 'zadd') {
            const [key, score, member] = op.args as [string, number, string];
            const arr = this.store.get(key) || [];
            arr.push({ score, member });
            this.store.set(key, arr);
            results.push([null, arr.length]);
          } else if (op.cmd === 'zcard') {
            const [key] = op.args as [string];
            const arr = this.store.get(key) || [];
            results.push([null, arr.length]);
          } else if (op.cmd === 'pexpire') {
            results.push([null, 1]);
          } else {
            results.push([null, 0]);
          }
        }
        return results;
      };
      const builder = {
        zremrangebyscore: (...args: any[]) => {
          ops.push({ cmd: 'zremrangebyscore', args });
          return builder;
        },
        zadd: (...args: any[]) => {
          ops.push({ cmd: 'zadd', args });
          return builder;
        },
        zcard: (...args: any[]) => {
          ops.push({ cmd: 'zcard', args });
          return builder;
        },
        pexpire: (...args: any[]) => {
          ops.push({ cmd: 'pexpire', args });
          return builder;
        },
        exec,
      };
      return builder;
    }

    quit = async () => {};
  }

  let limiter: SlidingWindowLimiter;

  beforeEach(async () => {
    limiter = new SlidingWindowLimiter();
    // 注入 mock redis
    (limiter as any).redis = new MockRedis();
    (limiter as any).logger = { warn: () => {}, error: () => {} };
  });

  it('allows requests within limit', async () => {
    const key = `test:${Date.now()}-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      const r = await limiter.check(key, 5, 1000);
      expect(r.allowed).toBe(true);
      expect(r.remaining).toBeGreaterThanOrEqual(0);
    }
  });

  it('blocks requests over limit', async () => {
    const key = `test:${Date.now()}-${Math.random()}`;
    for (let i = 0; i < 3; i++) {
      const r = await limiter.check(key, 3, 1000);
      expect(r.allowed).toBe(true);
    }
    const r = await limiter.check(key, 3, 1000);
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it('tracks count correctly', async () => {
    const key = `test:${Date.now()}-${Math.random()}`;
    await limiter.check(key, 10, 1000);
    await limiter.check(key, 10, 1000);
    const r = await limiter.check(key, 10, 1000);
    expect(r.count).toBe(3);
    expect(r.remaining).toBe(7);
  });

  it('uses different keys for independent limiters', async () => {
    const k1 = `test:k1-${Date.now()}`;
    const k2 = `test:k2-${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      await limiter.check(k1, 5, 1000);
    }
    // k1 已满, k2 仍空
    const r1 = await limiter.check(k1, 5, 1000);
    const r2 = await limiter.check(k2, 5, 1000);
    expect(r1.allowed).toBe(false);
    expect(r2.allowed).toBe(true);
  });
});
