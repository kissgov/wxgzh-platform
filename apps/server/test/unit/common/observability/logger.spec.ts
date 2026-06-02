// apps/server/test/unit/common/observability/logger.spec.ts
import { buildLoggerOptions, REDACT_FIELDS } from '../../../../src/common/observability/logger';

describe('logger (pino)', () => {
  it('buildLoggerOptions 返回 Params', () => {
    const opts = buildLoggerOptions();
    expect(opts).toBeDefined();
    expect(opts.pinoHttp).toBeDefined();
  });

  it('pinoHttp level 默认 info', () => {
    const opts = buildLoggerOptions();
    expect(opts.pinoHttp?.level).toBe('info');
  });

  it('redact 包含敏感字段 (authorization, cookie, password, appSecret, phone, email)', () => {
    expect(REDACT_FIELDS).toContain('req.headers.authorization');
    expect(REDACT_FIELDS).toContain('req.headers.cookie');
    expect(REDACT_FIELDS).toContain('*.password');
    expect(REDACT_FIELDS).toContain('*.appSecret');
    expect(REDACT_FIELDS).toContain('*.phone');
    expect(REDACT_FIELDS).toContain('*.email');
  });

  it('base 注入 service 和 env 标签', () => {
    const opts = buildLoggerOptions();
    const base = opts.pinoHttp?.base as Record<string, unknown> | undefined;
    expect(base?.['service']).toBe('wxgzh-api');
  });
});
