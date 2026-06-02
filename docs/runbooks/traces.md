# 链路追踪使用指南

> S3 接入 OpenTelemetry,所有 HTTP 请求自动生成 trace,响应头 `X-Trace-Id` 携带 trace 标识。
> 异步上下文通过 Node.js AsyncLocalStorage 透传,日志自动带 `trace_id`。

---

## 1. 获取 trace_id

**方式 A — 响应头**: 每个 HTTP 响应都带 `X-Trace-Id`
```bash
curl -i http://localhost:3000/api/v1/... | grep -i x-trace-id
```

**方式 B — 日志**: pino 输出的每条日志都有 `trace_id` 字段
```bash
grep "trace_id.*abc123" /var/log/wxgzh/api.log
```

**方式 C — 业务代码**: 通过 `getTraceId()` (S3 暴露的工具函数)
```typescript
import { getTraceId } from 'src/common/observability/trace-context';
const tid = getTraceId();
```

---

## 2. 查看单请求完整 trace

1. 拿到 trace_id (上面任一方式)
2. 打开 Grafana → Explore → 数据源选 Jaeger (或 Tempo,待接入)
3. 粘贴 trace_id 到 "Trace ID" 搜索框
4. 查看 span 树

> 当前 S3 阶段只配了 OTel SDK,未接 Jaeger/Tempo 后端。
> 阶段 2 (V2.1) 计划接入:选 OTLP 兼容后端 (Jaeger v1.35+ 或 Tempo)。

---

## 3. 常见排查模式

### 慢请求
1. 找到 trace 后, 看 span 树总时长
2. 找耗时最长的 span (通常是 DB query 或 outbound HTTP)
3. 若是 DB:看 SQL 文本, `EXPLAIN ANALYZE`
4. 若是 outbound:看目标 host + status

### 失败请求
1. 找到含 error 标记的 span
2. 看 error.message / error.stack
3. 沿 parent span 回溯, 找第一个失败点
4. 同一 trace 里其它 span 通常显示还在等待/重试

### 限频
1. 看 `wechat_api_calls_total{result="rate_limited"}` 时间序列
2. 找到对应时间点的 trace
3. 在 span 树里找 `http.client` span 目标为 `api.weixin.qq.com`

---

## 4. 业务代码埋点 (S3 阶段 2 计划)

如需在业务代码里加自定义 span:
```typescript
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('wxgzh-business');
return tracer.startActiveSpan('doSomething', async (span) => {
  try {
    span.setAttribute('tenant_id', tenantId);
    const result = await this.doWork();
    span.setStatus({ code: 1 }); // OK
    return result;
  } catch (err) {
    span.recordException(err);
    span.setStatus({ code: 2, message: err.message }); // ERROR
    throw err;
  } finally {
    span.end();
  }
});
```

---

## 5. 采样率配置

S3 默认 100% 采样 (开发期),生产建议降到 10%:
```bash
# .env
OTEL_TRACES_SAMPLER=parentbased_traceidratio
OTEL_TRACES_SAMPLER_ARG=0.1
```

降低延迟影响 + 后端存储压力。
