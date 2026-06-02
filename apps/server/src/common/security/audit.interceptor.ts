// AuditInterceptor + @AuditLog 装饰器
// ============================================================================
// 用法:
//   @AuditLog('authorizer.revoked', 'authorizer')
//   async revoke(@Param('id') id: string) { ... }
//
//   拦截器自动:
//   - 成功 → 写 audit_log(result=success)
//   - 失败 → 写 audit_log(result=failure, detail={error})
//   - 提取 resourceId: 优先从 params.id / params.authorizerId, 其次从返回值.id
// ============================================================================
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { AuditService } from './audit.service';

export interface AuditMeta {
  action: string;
  resource: string;
}

export const AUDIT_KEY = 'audit:action';

/** 标记方法需要审计 */
export const AuditLog = (action: string, resource?: string) =>
  SetMetadata(AUDIT_KEY, { action, resource: resource || action.split('.')[0] });

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly audit: AuditService,
    private readonly reflector: Reflector,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const meta = this.reflector.getAllAndOverride<AuditMeta>(AUDIT_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!meta) return next.handle();

    const req = ctx.switchToHttp().getRequest();
    const start = Date.now();
    const userId = req.user?.sub || 'anonymous';
    const tenantId = req.user?.tenantId || 'anonymous';
    const ip = req.ip;
    const userAgent = req.headers?.['user-agent'];

    return next.handle().pipe(
      tap((result: any) => {
        const resourceId = extractResourceId(req, result);
        this.audit.log({
          action: meta.action,
          resource: meta.resource,
          resourceId,
          userId,
          tenantId,
          ip,
          userAgent,
          detail: { result: 'success', durationMs: Date.now() - start },
        });
      }),
      catchError((err) => {
        const resourceId = extractResourceId(req, undefined);
        this.audit.log({
          action: meta.action,
          resource: meta.resource,
          resourceId,
          userId,
          tenantId,
          ip,
          userAgent,
          detail: { result: 'failure', error: err?.message, durationMs: Date.now() - start },
        });
        return throwError(() => err);
      }),
    );
  }
}

function extractResourceId(req: any, result: any): string | undefined {
  if (req.params?.id) return String(req.params.id);
  if (req.params?.authorizerId) return String(req.params.authorizerId);
  if (req.params?.userId) return String(req.params.userId);
  if (result?.id) return String(result.id);
  if (result?.data?.id) return String(result.data.id);
  return undefined;
}
