// usePermission — 前端权限检查 Hook
// ============================================================================
import { useMemo } from 'react';
import { useAuthStore } from '@/stores/auth.store';

/**
 * 检查当前用户是否拥有指定权限
 * @returns { hasPermission, hasAnyPermission, hasAllPermissions, hasRole, isAdmin }
 */
export function usePermission() {
  const user = useAuthStore((s) => s.user);

  const permissions = useMemo(() => user?.permissions || [], [user]);
  const roles = useMemo(() => user?.roles || [], [user]);

  const isSuperAdmin = roles.includes('super_admin');

  /** 检查单个权限 */
  const hasPermission = (perm: string): boolean => {
    if (isSuperAdmin) return true;
    return permissions.includes(perm);
  };

  /** 检查是否拥有任一权限 */
  const hasAnyPermission = (...perms: string[]): boolean => {
    if (isSuperAdmin) return true;
    return perms.some((p) => permissions.includes(p));
  };

  /** 检查是否拥有全部权限 */
  const hasAllPermissions = (...perms: string[]): boolean => {
    if (isSuperAdmin) return true;
    return perms.every((p) => permissions.includes(p));
  };

  /** 检查角色 */
  const hasRole = (...roleNames: string[]): boolean => {
    if (isSuperAdmin) return true;
    return roleNames.some((r) => roles.includes(r));
  };

  return {
    permissions,
    roles,
    isSuperAdmin,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
  };
}
