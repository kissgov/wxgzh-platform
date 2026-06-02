// apps/server/src/common/observability/logger.ts
// ---------------------------------------------------------------------------
// pino 工厂:统一日志格式 + 敏感字段 redact + trace_id 注入
// 由 LoggerModule.forRoot() 在 app.module 启动时注册。
// ---------------------------------------------------------------------------
import { Params } from 'nestjs-pino';
import pino from 'pino';

const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  '*.password',
  '*.passwordHash',
  '*.access_token',
  '*.accessToken',
  '*.refresh_token',
  '*.refreshToken',
  '*.appSecret',
  '*.appsecret',
  '*.phone',
  '*.email',
  'req.body.password',
];

export function buildLoggerOptions(): Params {
  return {
    pinoHttp: {
      level: process.env['LOG_LEVEL'] || 'info',
      transport: process.env['NODE_ENV'] !== 'production'
        ? { target: 'pino-pretty' }
        : undefined,
      redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
      formatters: { level: label => ({ level: label }) },
      base: { service: 'wxgzh-api', env: process.env['NODE_ENV'] },
      customProps: (req) => ({ trace_id: (req as any).id }),
    },
  };
}

// 测试用:导出 redact 路径供单测断言
export const REDACT_FIELDS = REDACT_PATHS;

// pino 实例(直接调用,绕过 nestjs-pino)
export const rootLogger = pino({
  level: process.env['LOG_LEVEL'] || 'info',
  base: { service: 'wxgzh-api', env: process.env['NODE_ENV'] },
  redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
});
