// TenantScopeGuard 单元测试
// ============================================================================
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  TenantScopeGuard,
  REQUIRE_TENANT_SCOPE_KEY,
} from '../../../../src/common/security/tenant-scope.guard';

describe('TenantScopeGuard', () => {
  let guard: TenantScopeGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new TenantScopeGuard(reflector);
  });

  function makeCtx(opts: {
    user?: any;
    params?: any;
    query?: any;
    body?: any;
    required?: boolean;
  }): ExecutionContext {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: any) => {
      if (key === REQUIRE_TENANT_SCOPE_KEY) return opts.required;
      return undefined;
    });
    return {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({
        getRequest: () => ({
          user: opts.user,
          params: opts.params,
          query: opts.query,
          body: opts.body,
        }),
      }),
    } as unknown as ExecutionContext;
  }

  it('passes when @RequireTenantScope is not set', () => {
    const ctx = makeCtx({ user: { tenantId: 't1' }, required: false });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('passes when tenantId matches in body', () => {
    const ctx = makeCtx({
      user: { tenantId: 't1', roles: ['operator'] },
      body: { tenantId: 't1', name: 'foo' },
      required: true,
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('passes for super_admin regardless of tenantId mismatch', () => {
    const ctx = makeCtx({
      user: { tenantId: 't1', roles: ['super_admin'] },
      body: { tenantId: 't2' },
      required: true,
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws Forbidden when body.tenantId does not match', () => {
    const ctx = makeCtx({
      user: { tenantId: 't1', roles: ['operator'] },
      body: { tenantId: 't2' },
      required: true,
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws Forbidden when query.tenantId does not match', () => {
    const ctx = makeCtx({
      user: { tenantId: 't1', roles: ['operator'] },
      query: { tenantId: 'evil-tenant' },
      required: true,
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws Forbidden when params.tenantId does not match', () => {
    const ctx = makeCtx({
      user: { tenantId: 't1', roles: ['operator'] },
      params: { tenantId: 't-attacker' },
      required: true,
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws when user.tenantId is missing', () => {
    const ctx = makeCtx({
      user: { roles: ['operator'] },
      required: true,
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
