// 日志拦截器 — 结构化 JSON 日志
// ============================================================================
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url } = request;
    const traceId = request.headers['x-trace-id'] as string;
    const tenantId = (request as any).tenantId as string;
    const now = Date.now();

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse<Response>();
        const duration = Date.now() - now;
        this.logger.log(
          JSON.stringify({
            method,
            url,
            status: response.statusCode,
            duration_ms: duration,
            trace_id: traceId,
            tenant_id: tenantId,
            timestamp: new Date().toISOString(),
          }),
        );
      }),
    );
  }
}
