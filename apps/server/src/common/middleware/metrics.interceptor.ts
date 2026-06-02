// apps/server/src/common/middleware/metrics.interceptor.ts
// ---------------------------------------------------------------------------
// HTTP 指标拦截器:每次请求记录 http_requests_total + http_request_duration_seconds
// route 取 req.route?.path(避免 path 维度爆炸),无则降级到通配 'unknown'
// ---------------------------------------------------------------------------
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
        error: (err) => this.record(req, start, err?.status ?? 500),
      }),
    );
  }
  private record(req: any, start: bigint, status: number) {
    const seconds = Number(process.hrtime.bigint() - start) / 1e9;
    const route = req.route?.path || req.path || 'unknown';
    const labels = { method: req.method, route, status: String(status) };
    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, seconds);
  }
}
