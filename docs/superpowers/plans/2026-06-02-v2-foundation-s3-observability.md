# V2.0 S3 — 可观测性 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 接入 OTel trace + Prometheus metrics + pino 结构化日志, 部署 4 块 Grafana 看板 (请求/队列/业务/告警), 配置关键告警规则。

**Architecture:** 集中式 `common/observability/` 仓, 在 `main.ts` 启动 OTel SDK, 替换 NestJS 内置 Logger 为 pino, 注入 Prometheus exporter 到 `/metrics` 端点; 4 块 Grafana 看板 JSON 入库。

**Tech Stack:** @opentelemetry/sdk-node 1.x / @opentelemetry/exporter-prometheus 0.x / @opentelemetry/instrumentation-* 0.x / pino 8 / nestjs-pino 4 / prom-client 15

**Spec:** [../specs/2026-06-02-v2-foundation-design.md §2.2 §3.1 §3.2](../specs/2026-06-02-v2-foundation-design.md)

**前置依赖:** S1 (测试底座), S2 (DTO/Zod)

**本 sprint 不动:**
- 不动业务 service 实现
- 不动 prisma schema
- 不动前端

---

## 累计文件结构 (本 sprint 创建)

```
apps/server/src/common/observability/        # 全部 NEW
├── otel.ts                                  # OTel SDK 初始化
├── metrics.ts                               # Prometheus exporter + 业务 counters/histograms
├── logger.ts                                # pino 工厂 + redaction 配置
├── trace.interceptor.ts                     # trace_id 注入
├── http.middleware.ts                       # OTel http instrumentation
├── trace-context.ts                         # AsyncLocalStorage 透传

apps/server/src/common/middleware/
└── metrics.interceptor.ts                   # Prometheus HTTP metrics

apps/server/test/unit/common/observability/
├── otel.spec.ts
├── metrics.spec.ts
└── logger.spec.ts

infra/                                       # NEW
├── prometheus/
│   ├── prometheus.yml                       # scrape config
│   └── alerts.yml                           # 关键告警规则
└── grafana/
    ├── datasources.yml                      # Prometheus 数据源
    └── dashboards/
        ├── http.json                        # 看板 1: HTTP 请求
        ├── queues.json                      # 看板 2: 队列
        ├── business.json                    # 看板 3: 业务指标
        └── alerts.json                      # 看板 4: 告警状态

docs/runbooks/
├── alerts.md                                # 告警响应手册
└── traces.md                                # 链路追踪使用指南

docker-compose.observability.yml             # NEW (本地启动 Prometheus + Grafana)
```

---

## Task 1: 安装依赖 + pino 替换 NestJS Logger

**Files:**
- Modify: `apps/server/package.json`
- Create: `apps/server/src/common/observability/logger.ts`
- Modify: `apps/server/src/main.ts`

- [ ] **Step 1: 装依赖**

```bash
cd apps/server
pnpm add nestjs-pino@4 pino@8 pino-pretty@11
pnpm add -D @types/pino@8
```

- [ ] **Step 2: 写 logger.ts (pino 工厂)**

```typescript
// apps/server/src/common/observability/logger.ts
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
      level: process.env.LOG_LEVEL || 'info',
      transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
      redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
      formatters: { level: label => ({ level: label }) },
      base: { service: 'wxgzh-api', env: process.env.NODE_ENV },
      customProps: (req) => ({ trace_id: (req as any).id }),
    },
  };
}
```

- [ ] **Step 3: main.ts 替换 logger**

```typescript
// 在 main.ts 顶部加
import { LoggerModule } from 'nestjs-pino';
import { buildLoggerOptions } from './common/observability/logger';

// 在 module 之前
app.useLogger(app.get(LoggerModule));
// 把 LoggerModule 加到 imports
LoggerModule.forRoot(buildLoggerOptions()),
```

(在 `app.module.ts` 改 `imports` 数组, 或在 `bootstrap` 之前 useGlobalPipes 时 useLogger。)

- [ ] **Step 4: 验证**

```bash
cd apps/server && pnpm dev
# 看到 "Nest application successfully started" 用 pino 格式输出
```

- [ ] **Step 5: 提交**

```bash
git add apps/server/src/common/observability/logger.ts apps/server/src/main.ts apps/server/src/app.module.ts package.json
git commit -m "feat(server): pino logger 替换 NestJS 内置 (含 redact)"
```

---

## Task 2: OTel SDK 初始化 + trace_id 注入

**Files:**
- Create: `apps/server/src/common/observability/otel.ts`
- Create: `apps/server/src/common/observability/trace.interceptor.ts`
- Create: `apps/server/src/common/observability/trace-context.ts`
- Modify: `apps/server/src/main.ts`

- [ ] **Step 1: 装 OTel**

```bash
cd apps/server
pnpm add @opentelemetry/sdk-node@0.52 @opentelemetry/api@1 @opentelemetry/auto-instrumentations-node@0.49 @opentelemetry/exporter-prometheus@0.52 @opentelemetry/exporter-trace-otlp-http@0.52 @opentelemetry/resources@1 @opentelemetry/semantic-conventions@1
```

- [ ] **Step 2: 写 otel.ts**

```typescript
// apps/server/src/common/observability/otel.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

let started = false;

export function startOtel() {
  if (started) return;
  const sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'wxgzh-api',
      [SemanticResourceAttributes.SERVICE_VERSION]: process.env.APP_VERSION || 'dev',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV,
    }),
    metricReader: new PrometheusExporter({ port: Number(process.env.OTEL_PROM_PORT || 9464) }),
    instrumentations: [getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
    })],
  });
  sdk.start();
  started = true;
  return sdk;
}
```

- [ ] **Step 3: main.ts 启动 OTel (必须在 import 业务代码前)**

```typescript
// apps/server/src/main.ts 顶部
import { startOtel } from './common/observability/otel';
startOtel();  // 在所有 import 完成后, bootstrap 之前

// 后续的 import { NestFactory } ... 保留
```

- [ ] **Step 4: 写 trace-context.ts (AsyncLocalStorage)**

```typescript
// apps/server/src/common/observability/trace-context.ts
import { AsyncLocalStorage } from 'node:async_hooks';

export interface TraceCtx { traceId: string; tenantId?: string; userId?: string; }
export const traceStorage = new AsyncLocalStorage<TraceCtx>();

export function getTraceId(): string | undefined { return traceStorage.getStore()?.traceId; }
```

- [ ] **Step 5: 写 trace.interceptor.ts (NestJS 拦截器)**

```typescript
// apps/server/src/common/observability/trace.interceptor.ts
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { trace, context as otelContext } from '@opentelemetry/api';
import { traceStorage } from './trace-context';

@Injectable()
export class TraceIdInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const req = ctx.switchToHttp().getRequest();
    const res = ctx.switchToHttp().getResponse();
    const span = trace.getSpan(otelContext.active());
    const traceId = span?.spanContext().traceId || req.headers['x-request-id'] || crypto.randomUUID();
    res.setHeader('X-Trace-Id', traceId);
    return traceStorage.run({ traceId, tenantId: req.user?.tenantId, userId: req.user?.sub }, () =>
      next.handle().pipe(tap(() => {})),
    );
  }
}
```

- [ ] **Step 6: 在 main.ts 注册全局拦截器**

```typescript
app.useGlobalInterceptors(new TraceIdInterceptor());
```

- [ ] **Step 7: 写 otel.spec.ts (smoke test)**

```typescript
// apps/server/test/unit/common/observability/otel.spec.ts
import { startOtel } from '../../../../src/common/observability/otel';

describe('OTel SDK', () => {
  it('启动幂等 (不抛)', () => {
    expect(() => startOtel()).not.toThrow();
    expect(() => startOtel()).not.toThrow();
  });
});
```

- [ ] **Step 8: 跑测试**

```bash
cd apps/server && pnpm test otel
```

Expected: PASS.

- [ ] **Step 9: 验证 `/metrics` 端点**

```bash
cd apps/server && pnpm dev
# 另一终端
curl http://localhost:9464/metrics | head -20
# 应看到 prometheus 格式输出
```

- [ ] **Step 10: 提交**

```bash
git add apps/server/src/common/observability apps/server/src/main.ts package.json
git commit -m "feat(server): OTel SDK + trace_id 注入 (header + AsyncLocalStorage)"
```

---

## Task 3: Prometheus 业务 metrics (HTTP + 队列 + 业务)

**Files:**
- Create: `apps/server/src/common/observability/metrics.ts`
- Create: `apps/server/src/common/middleware/metrics.interceptor.ts`
- Modify: `apps/server/src/main.ts`

- [ ] **Step 1: 写 metrics.ts (统一指标定义)**

```typescript
// apps/server/src/common/observability/metrics.ts
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
```

- [ ] **Step 2: 写 metrics.interceptor.ts**

```typescript
// apps/server/src/common/middleware/metrics.interceptor.ts
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { httpRequestsTotal, httpRequestDuration } from '../observability/metrics';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const req = ctx.switchToHttp().getRequest();
    const start = process.hrtime.bigint();
    return next.handle().pipe(
      tap({
        next: () => this.record(req, start, 200),
        error: (err) => this.record(req, start, err.status || 500),
      }),
    );
  }
  private record(req: any, start: bigint, status: number) {
    const seconds = Number(process.hrtime.bigint() - start) / 1e9;
    const route = req.route?.path || req.path;
    httpRequestsTotal.inc({ method: req.method, route, status });
    httpRequestDuration.observe({ method: req.method, route, status }, seconds);
  }
}
```

- [ ] **Step 3: main.ts 注册 + 暴露 `/metrics`**

```typescript
app.useGlobalInterceptors(new TraceIdInterceptor(), new MetricsInterceptor());

// 暴露 /metrics
import { metricsRegistry } from './common/observability/metrics';
import { collect } from 'prom-client';
app.use('/metrics', async (_req, res) => {
  res.set('Content-Type', metricsRegistry.contentType);
  res.send(await metricsRegistry.metrics());
});
```

- [ ] **Step 4: 写 metrics.spec.ts**

```typescript
import { httpRequestsTotal, metricsRegistry } from '../../../../src/common/observability/metrics';

describe('Metrics', () => {
  it('counter 可递增', async () => {
    httpRequestsTotal.inc({ method: 'GET', route: '/x', status: '200' });
    const text = await metricsRegistry.metrics();
    expect(text).toMatch(/http_requests_total/);
  });
});
```

- [ ] **Step 5: 验证**

```bash
curl http://localhost:3000/metrics | head -30
# 应看到 http_requests_total 等
```

- [ ] **Step 6: 提交**

```bash
git add apps/server/src/common/observability/metrics.ts apps/server/src/common/middleware apps/server/src/main.ts
git commit -m "feat(server): Prometheus 业务 metrics (HTTP + 微信 + 队列 + 业务事件)"
```

---

## Task 4: BullMQ 任务 metrics 集成

**Files:**
- Modify: `apps/server/src/tasks/token-refresh.processor.ts`
- Modify: `apps/server/src/tasks/sync-data.processor.ts`
- Modify: `apps/server/src/tasks/tag-rule.processor.ts`

- [ ] **Step 1: 写 process wrapper helper**

Create `apps/server/src/tasks/metrics-wrapper.ts`:

```typescript
import { queueJobsTotal, queueJobDuration } from '../common/observability/metrics';

export function wrapProcessor<T>(queueName: string, processor: (job: any) => Promise<T>) {
  return async (job: any) => {
    const start = process.hrtime.bigint();
    try {
      const result = await processor(job);
      const sec = Number(process.hrtime.bigint() - start) / 1e9;
      queueJobsTotal.inc({ queue: queueName, status: 'completed' });
      queueJobDuration.observe({ queue: queueName, status: 'completed' }, sec);
      return result;
    } catch (err) {
      const sec = Number(process.hrtime.bigint() - start) / 1e9;
      queueJobsTotal.inc({ queue: queueName, status: 'failed' });
      queueJobDuration.observe({ queue: queueName, status: 'failed' }, sec);
      throw err;
    }
  };
}
```

- [ ] **Step 2: 修改 3 个 processor (示例)**

```typescript
// token-refresh.processor.ts
import { wrapProcessor } from './metrics-wrapper';

@Processor('token-refresh')
export class TokenRefreshProcessor {
  @Process()
  async handle(job: Job) {
    return wrapProcessor('token-refresh', async () => {
      // 原本的逻辑
    })(job);
  }
}
```

(sync-data, tag-rule 同理)

- [ ] **Step 3: 验证 metrics**

启动 server, 触发一次 Token 刷新 (或 mock job), 检查 `queue_jobs_total{queue="token-refresh"}` 出现。

- [ ] **Step 4: 提交**

```bash
git commit -am "feat(tasks): BullMQ processor metrics 包装"
```

---

## Task 5: 业务事件埋点 (在 service 中)

**Files:**
- Modify: 各 `*.service.ts` 在关键动作处加 `businessEventsTotal.inc(...)`

- [ ] **Step 1: 在 follower.service.ts**

```typescript
import { businessEventsTotal } from '../../common/observability/metrics';

// 粉丝新增时
businessEventsTotal.inc({ event: 'follower_added', tenant_id: tenantId });
// 取关时
businessEventsTotal.inc({ event: 'follower_unsubscribed', tenant_id: tenantId });
```

- [ ] **Step 2: 在 message.service.ts / broadcast / send**

```typescript
businessEventsTotal.inc({ event: 'message_sent', tenant_id: tenantId });
businessEventsTotal.inc({ event: 'auto_reply_triggered', tenant_id: tenantId });
```

- [ ] **Step 3: 在 platform.service.ts (授权事件)**

```typescript
businessEventsTotal.inc({ event: 'authorizer_added', tenant_id: tenantId });
businessEventsTotal.inc({ event: 'authorizer_revoked', tenant_id: tenantId });
```

- [ ] **Step 4: 在 agent / llm / payment / content 各加 1-2 个**

- [ ] **Step 5: 跑测试全绿**

```bash
cd apps/server && pnpm test
```

- [ ] **Step 6: 提交**

```bash
git commit -am "feat: 业务事件 metrics 埋点 (follower/message/platform/...)"
```

---

## Task 6: Prometheus 配置 + 告警规则

**Files:**
- Create: `infra/prometheus/prometheus.yml`
- Create: `infra/prometheus/alerts.yml`

- [ ] **Step 1: 写 prometheus.yml**

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'wxgzh-api'
    static_configs:
      - targets: ['host.docker.internal:9464']
    metrics_path: /metrics
  - job_name: 'wxgzh-api-http'
    static_configs:
      - targets: ['host.docker.internal:3000']
    metrics_path: /metrics

rule_files:
  - alerts.yml
```

- [ ] **Step 2: 写 alerts.yml**

```yaml
groups:
  - name: wxgzh-alerts
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) > 0.05
        for: 5m
        labels: { severity: critical }
        annotations: { summary: "HTTP 5xx > 5% (5m)" }
      - alert: SlowP95Latency
        expr: histogram_quantile(0.95, sum by (le, route) (rate(http_request_duration_seconds_bucket[5m]))) > 1
        for: 10m
        labels: { severity: warning }
        annotations: { summary: "P95 > 1s on {{ $labels.route }}" }
      - alert: TokenRefreshFailure
        expr: rate(queue_jobs_total{queue="token-refresh",status="failed"}[15m]) > 0.1
        for: 5m
        labels: { severity: critical }
        annotations: { summary: "Token 刷新失败率 > 10%" }
      - alert: WechatApiRateLimited
        expr: rate(wechat_api_calls_total{result="rate_limited"}[5m]) > 1
        for: 5m
        labels: { severity: warning }
        annotations: { summary: "微信 API 触发限频" }
      - alert: QueueBacklog
        expr: bullmq_waiting_count > 1000
        for: 10m
        labels: { severity: warning }
        annotations: { summary: "队列积压 > 1000" }
```

- [ ] **Step 3: 提交**

```bash
git add infra/prometheus/
git commit -m "infra(prom): scrape config + 5 个告警规则"
```

---

## Task 7: Grafana 4 块看板

**Files:**
- Create: `infra/grafana/datasources.yml`
- Create: `infra/grafana/dashboards/http.json`
- Create: `infra/grafana/dashboards/queues.json`
- Create: `infra/grafana/dashboards/business.json`
- Create: `infra/grafana/dashboards/alerts.json`

- [ ] **Step 1: 写 datasources.yml**

```yaml
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
```

- [ ] **Step 2: 写 http.json 看板**

包含 6 个 panel:
- 请求速率 (stat)
- P50/P95/P99 延迟 (timeseries)
- 5xx 错误率 (timeseries)
- Top 10 慢路由 (table)
- 状态码分布 (pie)
- 租户 Top 10 (table)

(从 Grafana UI 导出 JSON, 简化版本。**完整 JSON 在任务文档附录中引用**, 或通过 `curl` 拉取。)

最小可启动版本 (5 个 panel):

```json
{
  "title": "HTTP 请求",
  "schemaVersion": 38,
  "panels": [
    {
      "id": 1, "type": "stat", "title": "QPS",
      "targets": [{ "expr": "sum(rate(http_requests_total[1m]))" }]
    },
    {
      "id": 2, "type": "timeseries", "title": "P95 延迟",
      "targets": [{ "expr": "histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))" }]
    },
    {
      "id": 3, "type": "timeseries", "title": "错误率",
      "targets": [{ "expr": "sum(rate(http_requests_total{status=~\"5..\"}[5m])) / sum(rate(http_requests_total[5m]))" }]
    },
    {
      "id": 4, "type": "table", "title": "Top 10 慢路由",
      "targets": [{ "expr": "topk(10, histogram_quantile(0.95, sum by (le, route) (rate(http_request_duration_seconds_bucket[5m]))))" }]
    },
    {
      "id": 5, "type": "piechart", "title": "状态码分布",
      "targets": [{ "expr": "sum by (status) (rate(http_requests_total[5m]))" }]
    }
  ]
}
```

(其他 3 块 json 同模式, 字段对齐。)

- [ ] **Step 3: 提交 (多次)**

```bash
git add infra/grafana/
git commit -m "infra(grafana): 4 看板 (http/queues/business/alerts) + 数据源"
```

---

## Task 8: Docker Compose (本地可启动 Prometheus + Grafana)

**Files:**
- Create: `docker-compose.observability.yml`

- [ ] **Step 1: 写 compose**

```yaml
version: '3.9'
services:
  prometheus:
    image: prom/prometheus:v2.51.0
    ports: ['9090:9090']
    volumes:
      - ./infra/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - ./infra/prometheus/alerts.yml:/etc/prometheus/alerts.yml:ro
    extra_hosts: ['host.docker.internal:host-gateway']
  grafana:
    image: grafana/grafana:10.4.0
    ports: ['3001:3000']
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - ./infra/grafana/datasources.yml:/etc/grafana/provisioning/datasources/datasources.yml:ro
      - ./infra/grafana/dashboards:/var/lib/grafana/dashboards:ro
```

- [ ] **Step 2: 启动验证**

```bash
docker compose -f docker-compose.observability.yml up -d
# 访问 http://localhost:3001 (admin/admin)
# 确认 4 块看板可见
```

- [ ] **Step 3: 提交**

```bash
git add docker-compose.observability.yml
git commit -m "infra: docker-compose 加 Prometheus + Grafana"
```

---

## Task 9: 告警响应手册 (runbook)

**Files:**
- Create: `docs/runbooks/alerts.md`
- Create: `docs/runbooks/traces.md`

- [ ] **Step 1: 写 alerts.md**

```markdown
# 告警响应手册

## HighErrorRate (HTTP 5xx > 5%)

**严重度**: critical
**可能原因**: 微信 API 全面失败 / DB 不可达 / 部署坏版本
**第一步**:
1. 打开 Grafana "HTTP 请求" 看板, 确认是哪个 route
2. 查看 `/var/log/wxgzh/api-error.log` 最近 5 分钟
3. 如是部署相关 → 触发 rollback (见 S5)
4. 如是下游服务 → 临时禁用该 route (feature flag)

## TokenRefreshFailure

**严重度**: critical
**影响**: 整个平台无法调微信 API
**第一步**:
1. 检查 component_verify_ticket 是否更新
2. 手动调 `POST /admin/refresh-component-token` 触发重试
3. 仍失败 → 微信开放平台后台检查第三方平台状态

## WechatApiRateLimited

**严重度**: warning
**第一步**:
1. 检查是哪个 component_appid 触发
2. 临时降级非关键调用 (粉丝同步、统计拉取)
3. 1 小时后恢复
```

- [ ] **Step 2: 写 traces.md**

```markdown
# 链路追踪使用指南

## 查看单请求完整 trace

1. 收到 trace_id (响应头 X-Trace-Id 或日志中 grep)
2. 打开 Grafana → Explore → Jaeger/Tempo
3. 粘贴 trace_id
4. 查看 span 树

## 常见模式

- 慢请求: 看哪个 span 占时长最长
- 失败请求: 看哪个 span 报错
- 限频: 看 wechat_api span
```

- [ ] **Step 3: 提交**

```bash
git add docs/runbooks/
git commit -m "docs: 告警响应 + 链路追踪 runbook"
```

---

## Task 10: 全量验证 + CI 集成

- [ ] **Step 1: 本地全量跑**

```bash
cd apps/server && pnpm test
docker compose -f docker-compose.observability.yml up -d
# 启动 server, 访问 localhost:3000/metrics, localhost:3001
```

- [ ] **Step 2: 验证 alert 规则加载**

```bash
curl http://localhost:9090/api/v1/rules
# 应返回 wxgzh-alerts 5 条规则
```

- [ ] **Step 3: CI 集成 (test job 加 observability smoke)**

Modify `.github/workflows/ci.yml` 在 test 阶段加:

```yaml
      - name: OTel smoke
        run: cd apps/server && pnpm test observability
```

- [ ] **Step 4: 推 PR + 提交**

```bash
git commit -am "ci: observability smoke test"
git push
```

---

## Task 11: 完工验证 + 更新顶层 plan

- [ ] **Step 1: 验证 4 块看板可访问**

- [ ] **Step 2: 触发一次告警 (手动 kill DB 30 秒, 验证 HighErrorRate 触发)**

- [ ] **Step 3: 更新顶层 plan 标记 S3 完成**

---

## 完工判定 (S3)

- [ ] `/metrics` 端点返回 Prometheus 格式
- [ ] `/api/docs` Swagger 在线 (V1 应已有)
- [ ] Grafana 4 块看板可见 + 5 个告警规则加载
- [ ] X-Trace-Id 在每个响应头
- [ ] pino 日志 redact 配置生效 (访问日志无敏感字段)
- [ ] docs/runbooks/ 写好

→ S3 完成, 进入 S4 (安全加固)
