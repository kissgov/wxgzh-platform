// 共享 Zod schema — 被多个 contract 复用,避免循环引用
// ============================================================================
// 命名约定:本文件以 `_` 开头,标记其为内部基础设施,不应被 controller / service
// 直接 import,只允许其他 contract 文件 import。controller / service 应继续
// 通过 `auth.contract`(或未来的 users/tenants/roles contract)re-export 拿到。
// ============================================================================
import { z } from 'zod';

/** 当前用户信息 (login / register / me / profile / team member 等场景) */
export const UserInfoSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  email: z.string().email(),
  avatar: z.string().nullable(),
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
});
export type UserInfo = z.infer<typeof UserInfoSchema>;

/** 租户简略信息 (login / register / team member 关联查询等) */
export const TenantInfoSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  slug: z.string(),
});
export type TenantInfo = z.infer<typeof TenantInfoSchema>;
