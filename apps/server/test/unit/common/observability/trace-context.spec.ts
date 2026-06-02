// apps/server/test/unit/common/observability/trace-context.spec.ts
import { traceStorage, getTraceId, getTraceContext } from '../../../../src/common/observability/trace-context';

describe('trace-context (AsyncLocalStorage)', () => {
  it('默认无 ctx', () => {
    expect(getTraceId()).toBeUndefined();
    expect(getTraceContext()).toBeUndefined();
  });

  it('在 run() 内可读,run 外不可读', () => {
    expect.assertions(4);
    traceStorage.run({ traceId: 'abc-123', tenantId: 't1', userId: 'u1' }, () => {
      expect(getTraceId()).toBe('abc-123');
      const ctx = getTraceContext();
      expect(ctx?.tenantId).toBe('t1');
      expect(ctx?.userId).toBe('u1');
    });
    expect(getTraceId()).toBeUndefined();
  });

  it('嵌套 run() 取最近 ctx', () => {
    expect.assertions(2);
    traceStorage.run({ traceId: 'outer' }, () => {
      traceStorage.run({ traceId: 'inner' }, () => {
        expect(getTraceId()).toBe('inner');
      });
      expect(getTraceId()).toBe('outer');
    });
  });
});
