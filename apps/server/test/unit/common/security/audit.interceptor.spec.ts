// AuditInterceptor 单元测试 (使用 mock service)
// ============================================================================
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of, throwError } from 'rxjs';
import { AuditInterceptor } from '../../../../src/common/security/audit.interceptor';
import { AUDIT_KEY } from '../../../../src/common/security/audit.interceptor';

describe('AuditInterceptor', () => {
  let interceptor: AuditInterceptor;
  let logMock: jest.Mock;

  beforeEach(() => {
    logMock = jest.fn().mockResolvedValue(undefined);
    const audit = { log: logMock } as any;
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: any) => {
      if (key === AUDIT_KEY) return { action: 'test.action', resource: 'test' };
      return undefined;
    });
    interceptor = new AuditInterceptor(audit, reflector);
  });

  function makeCtx(user: any = { sub: 'u1', tenantId: 't1' }): ExecutionContext {
    return {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          params: { id: 'r1' },
          ip: '1.2.3.4',
          headers: { 'user-agent': 'jest' },
        }),
      }),
    } as unknown as ExecutionContext;
  }

  it('logs success when handler resolves', async () => {
    const handler = { handle: () => of({ id: 'r1', data: 'ok' }) };
    await new Promise<void>((resolve) => {
      interceptor.intercept(makeCtx(), handler).subscribe({
        complete: () => {
          expect(logMock).toHaveBeenCalledTimes(1);
          const call = logMock.mock.calls[0][0];
          expect(call.action).toBe('test.action');
          expect(call.resourceId).toBe('r1');
          expect(call.detail.result).toBe('success');
          resolve();
        },
      });
    });
  });

  it('logs failure when handler throws', async () => {
    const handler = { handle: () => throwError(() => new Error('boom')) };
    await new Promise<void>((resolve) => {
      interceptor.intercept(makeCtx(), handler).subscribe({
        error: () => {
          expect(logMock).toHaveBeenCalledTimes(1);
          const call = logMock.mock.calls[0][0];
          expect(call.detail.result).toBe('failure');
          expect(call.detail.error).toBe('boom');
          resolve();
        },
      });
    });
  });

  it('uses anonymous user when no user context', async () => {
    const handler = { handle: () => of({ id: 'r1' }) };
    // 显式传 null 触发默认参数, 然后覆盖为 undefined
    const ctx = makeCtx(null as any);
    // 覆盖 switchToHttp 行为, 让 user 真正为 undefined
    (ctx.switchToHttp as any) = () => ({
      getRequest: () => ({
        user: undefined,
        params: { id: 'r1' },
        ip: '1.2.3.4',
        headers: { 'user-agent': 'jest' },
      }),
    });
    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx, handler).subscribe({
        complete: () => {
          const call = logMock.mock.calls[0][0];
          expect(call.userId).toBe('anonymous');
          expect(call.tenantId).toBe('anonymous');
          resolve();
        },
      });
    });
  });
});
