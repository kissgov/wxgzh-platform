// AbstractService 单元测试 — safe() 包装器
// ============================================================================
import { AbstractService } from './abstract-service';

class TestService extends AbstractService {
  async doIt() {
    return this.safe('doIt', async () => 'ok');
  }
  async fail() {
    return this.safe('fail', async () => {
      throw new Error('boom');
    });
  }
  async withCtx() {
    return this.safe('withCtx', async () => 'ok', { userId: 'u1' });
  }
}

describe('AbstractService.safe', () => {
  it('returns result on success', async () => {
    const s = new TestService();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (s as any).logger = { debug: jest.fn(), error: jest.fn() };
    await expect(s.doIt()).resolves.toBe('ok');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((s as any).logger.debug).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'doIt', durationMs: expect.any(Number) }),
      'doIt ok',
    );
  });

  it('throws and logs on failure', async () => {
    const s = new TestService();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (s as any).logger = { debug: jest.fn(), error: jest.fn() };
    await expect(s.fail()).rejects.toThrow('boom');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((s as any).logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'fail', err: 'boom' }),
      'fail failed',
    );
  });

  it('passes ctx to log', async () => {
    const s = new TestService();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (s as any).logger = { debug: jest.fn(), error: jest.fn() };
    await s.withCtx();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((s as any).logger.debug).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1' }),
      'withCtx ok',
    );
  });
});
