// CanAccess — 权限门控组件
// 用法: <CanAccess permission="follower:read"><Button>删除</Button></CanAccess>
//       <CanAccess role="admin"><SettingsPage /></CanAccess>
//       <CanAccess permissions={['follower:delete', 'follower:update']}><Button /></CanAccess>
// ============================================================================
import { ReactNode } from 'react';
import { usePermission } from '@/hooks/usePermission';

interface Props {
  /** 需要的单个权限 */
  permission?: string;
  /** 需要的任一权限（OR 逻辑） */
  permissions?: string[];
  /** 需要的全部权限（AND 逻辑） */
  allPermissions?: string[];
  /** 需要的角色 */
  role?: string;
  /** 需要的任一角色（OR 逻辑） */
  roles?: string[];
  /** 无权限时显示的内容（默认隐藏） */
  fallback?: ReactNode;
  children: ReactNode;
}

export default function CanAccess({
  permission,
  permissions: permList,
  allPermissions,
  role,
  roles: roleList,
  fallback = null,
  children,
}: Props) {
  const { hasPermission, hasAnyPermission, hasAllPermissions, hasRole } = usePermission();

  if (role && !hasRole(role)) return <>{fallback}</>;
  if (roleList?.length && !hasRole(...roleList)) return <>{fallback}</>;

  if (permission && !hasPermission(permission)) return <>{fallback}</>;
  if (permList?.length && !hasAnyPermission(...permList)) return <>{fallback}</>;
  if (allPermissions?.length && !hasAllPermissions(...allPermissions)) return <>{fallback}</>;

  return <>{children}</>;
}
