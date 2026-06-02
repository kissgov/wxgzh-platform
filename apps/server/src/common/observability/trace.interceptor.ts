// apps/server/src/common/observability/trace.interceptor.ts
// ---------------------------------------------------------------------------
// 全局 trace_id 拦截器 (S3 升级版,兼容 V1 行为):
// 1. 从 OTel active span 取 traceId (S3)
// 2. 兜底: x-request-id header 或随机 UUID
// 3. 写响应头 X-Trace-Id (S3 新增)
// 4. 通过 AsyncLocalStorage 透传到 service / 日志 (S3 新增)
// 5. 注入响应体 trace_id 字段 (V1 行为,HttpExceptionFilter 已在错误上设过则不覆盖)
// ---------------------------------------------------------------------------
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { trace, context as otelContext } from '@opentelemetry/api';
import { randomUUID } from 'node:crypto';
import { traceStorage } from './trace-context';

@Injectable()
export class TraceIdInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const httpCtx = ctx.switchToHttp();
    const req = httpCtx.getRequest();
    const res = httpCtx.getResponse();

    // 优先级: OTel span > x-request-id > 随机
    const span = trace.getSpan(otelContext.active());
    const traceId =
      span?.spanContext().traceId ||
      (req.headers['x-request-id'] as string | undefined) ||
      (req.headers['x-trace-id'] as string | undefined) || // 兼容 V1 header
      randomUUID();

    res.setHeader('X-Trace-Id', traceId);

    const traceCtx = {
      traceId,
      tenantId: req.user?.tenantId,
      userId: req.user?.sub,
    };

    return traceStorage.run(traceCtx, () =>
      next.handle().pipe(
        // V1 行为: 注入到响应体 (HttpExceptionFilter 已设则不覆盖)
        map((data) => {
          if (data && typeof data === 'object' && !Array.isArray(data)) {
            if (!('trace_id' in data)) {
              (data as Record<string, unknown>)['trace_id'] = traceId;
            }
          }
          return data;
        }),
        tap(() => {}),
      ),
    );
  }
}
