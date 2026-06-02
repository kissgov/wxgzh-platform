/**
 * 租户内用户/角色/订阅模块 Zod 契约
 *
 * - InputSchema 严格对应 TenantController method 入参 (4 个 body 入参)
 * - OutputSchema 对应 TenantService 实际返回结构 (service 是 source of truth)
 * - 复用 _shared 中的 TenantInfoSchema / UserInfoSchema
 *
 * 字段命名: camelCase (V1 风格)
 */
import { z } from 'zod';
import { UserInfoSchema, TenantInfoSchema } from './_shared';

// ── 通用子 schema ────────────────────────────────────────────────────────

/** 角色简略信息 (服务侧 select 返回的最小投影) */
const RoleBriefSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  slug: z.string(),
});
export type RoleBrief = z.infer<typeof RoleBriefSchema>;

/** 权限简略信息 */
const PermissionBriefSchema = z.object({
  id: z.string().min(1),
  slug: z.string(),
  name: z.string(),
  action: z.string(),
});
export type PermissionBrief = z.infer<typeof PermissionBriefSchema>;

/** 公众号简略信息 */
const AuthorizerBriefSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
});
export type AuthorizerBrief = z.infer<typeof AuthorizerBriefSchema>;

/** 完整用户(列表) — service.getUsers 投影 + roles/authorizers */
const UserWithRelationsSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  email: z.string().email(),
  status: z.string(),
  createdAt: z.string().datetime(),
  lastLoginAt: z.string().datetime().nullable(),
  roles: z.array(RoleBriefSchema),
  authorizers: z.array(AuthorizerBriefSchema),
});
export type UserWithRelations = z.infer<typeof UserWithRelationsSchema>;

/** 完整角色 — service.getRoles / createRole 返回 */
const RoleWithPermissionsSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  slug: z.string(),
  isSystem: z.boolean(),
  isDefault: z.boolean(),
  permissions: z.array(PermissionBriefSchema),
});
export type RoleWithPermissions = z.infer<typeof RoleWithPermissionsSchema>;

/** 公众号(authorizer)信息 — service.getUserAuthorizers 返回 */
const AuthorizerInfoSchema = z.object({
  id: z.string().min(1),
  nickName: z.string(),
  headImg: z.string().nullable(),
  appType: z.string(),
});
export type AuthorizerInfo = z.infer<typeof AuthorizerInfoSchema>;

/** 订阅记录 — service.getSubscription.records 直接来自 prisma.subscriptionRecord */
const SubscriptionRecordSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  plan: z.string(),
  period: z.string(),
  amount: z.number().int(),
  startedAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable(),
  status: z.string(),
  createdAt: z.string().datetime(),
});
export type SubscriptionRecord = z.infer<typeof SubscriptionRecordSchema>;

/** 订阅信息 — service.getSubscription 返回 */
const SubscriptionInfoSchema = z.object({
  plan: z.string(),
  planName: z.string(),
  billingPeriod: z.string(),
  subscriptionExpiresAt: z.string().datetime().nullable(),
  trialEndsAt: z.string().datetime().nullable(),
  maxAuthorizers: z.number().int(),
  maxUsers: z.number().int(),
  records: z.array(SubscriptionRecordSchema),
});
export type SubscriptionInfo = z.infer<typeof SubscriptionInfoSchema>;

/** 空响应 (data: null) — 用于 PUT/DELETE 等无返回数据的方法 */
export const VoidResponseSchema = z.null();
export type VoidResponse = z.infer<typeof VoidResponseSchema>;

// ── 4 个 Input schema ────────────────────────────────────────────────────

/** POST /users — 创建租户内用户 */
export const CreateUserInputSchema = z.object({
  name: z.string().min(1, '请填写姓名'),
  email: z.string().email('请输入有效邮箱'),
  password: z.string().min(6, '密码至少 6 位').max(64, '密码最多 64 位'),
  roleIds: z.array(z.string().min(1)).optional(),
  authorizerIds: z.array(z.string().min(1)).optional(),
});
export type CreateUserInput = z.infer<typeof CreateUserInputSchema>;

/** PUT /users/:userId — 更新用户(全字段可选) */
export const UpdateUserInputSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.string().optional(),
  roleIds: z.array(z.string().min(1)).optional(),
  authorizerIds: z.array(z.string().min(1)).optional(),
});
export type UpdateUserInput = z.infer<typeof UpdateUserInputSchema>;

/** POST /roles — 创建角色 */
export const CreateRoleInputSchema = z.object({
  name: z.string().min(1, '请填写角色名'),
  slug: z.string().min(1, '请填写角色 slug').regex(/^[a-z0-9_-]+$/i, 'slug 只能包含字母、数字、下划线、连字符'),
  permissionIds: z.array(z.string().min(1)).optional(),
});
export type CreateRoleInput = z.infer<typeof CreateRoleInputSchema>;

/** PUT /roles/:roleId — 更新角色(全字段可选) */
export const UpdateRoleInputSchema = z.object({
  name: z.string().min(1).optional(),
  permissionIds: z.array(z.string().min(1)).optional(),
});
export type UpdateRoleInput = z.infer<typeof UpdateRoleInputSchema>;

// ── 11 个 Output schema ──────────────────────────────────────────────────

/** GET /tenants — service.getTenants */
export const ListTenantsOutputSchema = z.array(TenantInfoSchema);
export type ListTenantsOutput = z.infer<typeof ListTenantsOutputSchema>;

/** GET /users — service.getUsers */
export const ListUsersOutputSchema = z.array(UserWithRelationsSchema);
export type ListUsersOutput = z.infer<typeof ListUsersOutputSchema>;

/** POST /users — service.createUser 返回 {id, name, email} */
export const CreateUserOutputSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  email: z.string().email(),
});
export type CreateUserOutput = z.infer<typeof CreateUserOutputSchema>;

/** PUT /users/:userId — service.updateUser 无 data */
export const UpdateUserOutputSchema = VoidResponseSchema;

/** GET /roles — service.getRoles */
export const ListRolesOutputSchema = z.array(RoleWithPermissionsSchema);
export type ListRolesOutput = z.infer<typeof ListRolesOutputSchema>;

/** POST /roles — service.createRole 直接返回 prisma 完整 record */
export const CreateRoleOutputSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1).nullable(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  isSystem: z.boolean(),
  isDefault: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});
export type CreateRoleOutput = z.infer<typeof CreateRoleOutputSchema>;

/** PUT /roles/:roleId — service.updateRole 无 data */
export const UpdateRoleOutputSchema = VoidResponseSchema;

/** DELETE /roles/:roleId — 无 data */
export const DeleteRoleOutputSchema = VoidResponseSchema;

/** GET /my-authorizers — service.getUserAuthorizers */
export const GetMyAuthorizersOutputSchema = z.array(AuthorizerInfoSchema);
export type GetMyAuthorizersOutput = z.infer<typeof GetMyAuthorizersOutputSchema>;

/** GET /my-subscription — service.getSubscription 返回 null 或完整信息 */
export const GetMySubscriptionOutputSchema = SubscriptionInfoSchema.nullable();
export type GetMySubscriptionOutput = z.infer<typeof GetMySubscriptionOutputSchema>;

/** GET /plans — service.getPlans 返回 prisma subscriptionPlan 列表(具体字段不固定,用 record) */
export const ListPlansOutputSchema = z.array(z.record(z.string(), z.unknown()));
export type ListPlansOutput = z.infer<typeof ListPlansOutputSchema>;

/** GET /permissions — service.getPermissions 返回按资源分组的权限 */
export const ListPermissionsOutputSchema = z.record(z.string(), z.array(PermissionBriefSchema));
export type ListPermissionsOutput = z.infer<typeof ListPermissionsOutputSchema>;
