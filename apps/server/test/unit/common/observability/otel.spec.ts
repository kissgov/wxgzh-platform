// apps/server/test/unit/common/observability/otel.spec.ts
import { startOtel, isOtelStarted } from '../../../../src/common/observability/otel';

describe('OTel SDK', () => {
  it('startOtel 启动成功且幂等', () => {
    expect(() => startOtel()).not.toThrow();
    expect(isOtelStarted()).toBe(true);
    // 二次调用不抛
    expect(() => startOtel()).not.toThrow();
  });
});
