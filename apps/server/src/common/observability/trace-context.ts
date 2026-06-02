// apps/server/src/common/observability/trace-context.ts
// ---------------------------------------------------------------------------
// AsyncLocalStorage 透传 trace_id / tenantId / userId
// 在 TraceIdInterceptor 中写入,日志/业务代码可随时读
// ---------------------------------------------------------------------------
import { AsyncLocalStorage } from 'node:async_hooks';

export interface TraceCtx {
  traceId: string;
  tenantId?: string;
  userId?: string;
}

export const traceStorage = new AsyncLocalStorage<TraceCtx>();

export function getTraceId(): string | undefined {
  return traceStorage.getStore()?.traceId;
}

export function getTraceContext(): TraceCtx | undefined {
  return traceStorage.getStore();
}
