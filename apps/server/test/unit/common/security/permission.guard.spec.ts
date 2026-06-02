// PermissionGuard 单元测试
// ============================================================================
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionGuard } from '../../../../src/common/security/permission.guard';
import {
  PERMISSIONS,
  type Permission,
} from '../../../../src/common/security/permissions';
import { REQUIRE_PERMISSION_KEY } from '../../../../src/common/security/require-permission.decorator';
import { IS_PUBLIC_KEY } from '../../../../src/common/decorators/current-user.decorator';

describe('PermissionGuard', () => {
  let guard: PermissionGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionGuard(reflector);
  });

  // 工具: 构造 mock ExecutionContext
  function makeCtx(opts: {
    user?: any;
    required?: readonly Permission[];
    isPublic?: boolean;
  }): ExecutionContext {
    // 模拟 metadata 行为
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: any) => {
      if (key === IS_PUBLIC_KEY) return opts.isPublic;
      if (key === REQUIRE_PERMISSION_KEY) return opts.required;
      return undefined;
    });
    return {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({
        getRequest: () => ({ user: opts.user }),
      }),
    } as unknown as ExecutionContext;
  }

  it('passes when @Public() is set', () => {
    const ctx = makeCtx({ isPublic: true, user: undefined });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('passes when no @RequirePermission is set (向后兼容)', () => {
    const ctx = makeCtx({ user: { sub: 'u1', tenantId: 't1', roles: ['analyst'], permissions: [] } });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('passes when super_admin (绕过所有权限检查)', () => {
    const ctx = makeCtx({
      user: { sub: 'u1', tenantId: 't1', roles: ['super_admin'], permissions: [] },
      required: [PERMISSIONS.FOLLOWER_READ],
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('passes when user has the required permission', () => {
    const ctx = makeCtx({
      user: { sub: 'u1', tenantId: 't1', roles: ['operator'], permissions: ['follower:read'] },
      required: [PERMISSIONS.FOLLOWER_READ],
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws Forbidden when missing a required permission (AND 语义)', () => {
    const ctx = makeCtx({
      user: { sub: 'u1', tenantId: 't1', roles: ['operator'], permissions: ['follower:read'] },
      required: [PERMISSIONS.FOLLOWER_READ, PERMISSIONS.FOLLOWER_WRITE],
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws Forbidden when user has no user context', () => {
    const ctx = makeCtx({
      user: undefined,
      required: [PERMISSIONS.FOLLOWER_READ],
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws Forbidden when user.permissions is empty', () => {
    const ctx = makeCtx({
      user: { sub: 'u1', tenantId: 't1', roles: ['analyst'], permissions: [] },
      required: [PERMISSIONS.FOLLOWER_WRITE],
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
