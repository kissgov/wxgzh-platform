// TraceId 拦截器 — 注入或生成 trace_id 到请求头和响应体
// ============================================================================
import {
  Injectable, NestInterceptor, ExecutionContext, CallHandler,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { Request } from 'express';

@Injectable()
export class TraceIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const traceId = (request.headers['x-trace-id'] as string) || uuid();
    request.headers['x-trace-id'] = traceId;

    // 将 traceId 注入到响应体中
    return next.handle().pipe(
      map((data) => {
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          // 如果 data 已经有 trace_id 则不覆盖（HttpExceptionFilter 设置的）
          if (!('trace_id' in data)) {
            (data as Record<string, unknown>)['trace_id'] = traceId;
          }
        }
        return data;
      }),
    );
  }
}
