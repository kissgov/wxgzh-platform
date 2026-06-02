// apps/server/src/common/observability/metrics.ts
// ---------------------------------------------------------------------------
// Prometheus 指标统一注册表
// - 默认 Node 指标 (process_*, nodejs_*) 开启
// - 业务: HTTP / 微信 API / 队列 / 业务事件
// - /metrics 端点通过此 registry 暴露
// ---------------------------------------------------------------------------
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

export const metricsRegistry = new Registry();
collectDefaultMetrics({ register: metricsRegistry });

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'] as const,
  registers: [metricsRegistry],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

export const wechatApiCallsTotal = new Counter({
  name: 'wechat_api_calls_total',
  help: 'Wechat API calls',
  labelNames: ['endpoint', 'result'] as const,
  registers: [metricsRegistry],
});

export const queueJobsTotal = new Counter({
  name: 'queue_jobs_total',
  help: 'BullMQ jobs processed',
  labelNames: ['queue', 'status'] as const,
  registers: [metricsRegistry],
});

export const queueJobDuration = new Histogram({
  name: 'queue_job_duration_seconds',
  help: 'BullMQ job duration',
  labelNames: ['queue', 'status'] as const,
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 300],
  registers: [metricsRegistry],
});

export const businessEventsTotal = new Counter({
  name: 'business_events_total',
  help: 'Business events (follower_added, message_sent, etc.)',
  labelNames: ['event', 'tenant_id'] as const,
  registers: [metricsRegistry],
});
