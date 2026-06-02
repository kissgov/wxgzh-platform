// @RequirePermission 装饰器 — 多权限 AND 语义
// ============================================================================
// 用法:
//   @RequirePermission(PERMISSIONS.FOLLOWER_READ)                 // 单一
//   @RequirePermission(PERMISSIONS.FOLLOWER_READ, PERMISSIONS.FOLLOWER_WRITE)  // 全部需要
// ============================================================================
import { SetMetadata } from '@nestjs/common';
import type { Permission } from './permissions';

export const REQUIRE_PERMISSION_KEY = 'require:permission';

/** 标记方法/类需要的权限 (AND 语义: 所有列出权限都必须拥有) */
export const RequirePermission = (...perms: readonly Permission[]) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, perms);
