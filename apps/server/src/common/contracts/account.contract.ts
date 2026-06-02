/**
 * 多公众号管理模块 Zod 契约
 *
 * - InputSchema 严格对应 AccountController method 入参 (4 个 body / query 入参)
 * - OutputSchema 对应 AccountService 实际返回结构 (service 是 source of truth)
 * - 覆盖公众号列表(含分组) / 分组树 / 分组 CRUD / 分组-公众号关联
 *
 * 字段命名: camelCase (V1 风格)
 */
import { z } from 'zod';

// ── 通用子 schema ────────────────────────────────────────────────────────

/** 分组简略信息(列表项关联) */
const GroupBriefSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
});
export type GroupBrief = z.infer<typeof GroupBriefSchema>;

/** 公众号(含分组) — service.getAccounts 列表项 (prisma.authorizer 全字段去 token + groups) */
const AuthorizerWithGroupsSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  componentAppId: z.string().min(1),
  appId: z.string().min(1),
  appType: z.number().int(),
  nickName: z.string(),
  headImg: z.string().nullable(),
  qrcodeUrl: z.string().nullable(),
  principalName: z.string().nullable(),
  signature: z.string().nullable(),
  tokenExpireAt: z.string().datetime().nullable(),
  funcInfo: z.unknown(),
  serviceInfo: z.unknown().nullable(),
  verifyInfo: z.unknown().nullable(),
  status: z.string(),
  authorizedAt: z.string().datetime(),
  expiredAt: z.string().datetime().nullable(),
  lastSyncAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
  groups: z.array(GroupBriefSchema),
});
export type AuthorizerWithGroups = z.infer<typeof AuthorizerWithGroupsSchema>;

/** 分组树节点 — service.getGroupTree 返回 */
const GroupTreeNodeSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  parentId: z.string().nullable(),
  sortOrder: z.number().int(),
  accountCount: z.number().int().nonnegative(),
});
export type GroupTreeNode = z.infer<typeof GroupTreeNodeSchema>;

/** 公众号分组(完整记录) — service.createGroup / updateGroup 直接返回 prisma.accountGroup */
const AccountGroupSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  name: z.string(),
  parentId: z.string().nullable(),
  sortOrder: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});
export type AccountGroup = z.infer<typeof AccountGroupSchema>;

/** 空响应 (data: null) */
export const VoidResponseSchema = z.null();
export type VoidResponse = z.infer<typeof VoidResponseSchema>;

// ── 4 个 Input schema ────────────────────────────────────────────────────

/** GET /accounts — 公众号列表查询 */
export const AccountListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  page_size: z.coerce.number().int().min(1).max(100).optional().default(20),
  groupId: z.string().min(1).optional(),
  keyword: z.string().optional(),
  appType: z.enum(['0', '1', '2']).optional(),
});
export type AccountListQuery = z.infer<typeof AccountListQuerySchema>;

/** POST /accounts/groups — 创建分组 */
export const CreateGroupInputSchema = z.object({
  name: z.string().min(1, '请填写分组名称'),
  parentId: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
});
export type CreateGroupInput = z.infer<typeof CreateGroupInputSchema>;

/** PUT /accounts/groups/:groupId — 编辑分组 */
export const UpdateGroupInputSchema = z.object({
  name: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
});
export type UpdateGroupInput = z.infer<typeof UpdateGroupInputSchema>;

/** POST /accounts/groups/:groupId/items — 添加公众号到分组 */
export const AddAccountsToGroupInputSchema = z.object({
  authorizerIds: z.array(z.string().min(1)).min(1, '请至少添加一个公众号'),
});
export type AddAccountsToGroupInput = z.infer<typeof AddAccountsToGroupInputSchema>;

// ── 7 个 Output schema ───────────────────────────────────────────────────

/** GET /accounts — service.getAccounts 分页 */
export const ListAccountsOutputSchema = z.object({
  list: z.array(AuthorizerWithGroupsSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  page_size: z.number().int().positive(),
});
export type ListAccountsOutput = z.infer<typeof ListAccountsOutputSchema>;

/** GET /accounts/groups — service.getGroupTree */
export const GetGroupTreeOutputSchema = z.array(GroupTreeNodeSchema);
export type GetGroupTreeOutput = z.infer<typeof GetGroupTreeOutputSchema>;

/** POST /accounts/groups — service.createGroup */
export const CreateGroupOutputSchema = AccountGroupSchema;
export type CreateGroupOutput = z.infer<typeof CreateGroupOutputSchema>;

/** PUT /accounts/groups/:groupId — service.updateGroup */
export const UpdateGroupOutputSchema = AccountGroupSchema;
export type UpdateGroupOutput = z.infer<typeof UpdateGroupOutputSchema>;

/** DELETE /accounts/groups/:groupId — V1 行为 data: null */
export const DeleteGroupOutputSchema = VoidResponseSchema;
export type DeleteGroupOutput = z.infer<typeof DeleteGroupOutputSchema>;

/** POST /accounts/groups/:groupId/items — service.addToGroup 返回 { added: number } */
export const AddToGroupOutputSchema = z.object({
  added: z.number().int().nonnegative(),
});
export type AddToGroupOutput = z.infer<typeof AddToGroupOutputSchema>;

/** DELETE /accounts/groups/:groupId/items/:authorizerId — V1 行为 data: null */
export const RemoveFromGroupOutputSchema = VoidResponseSchema;
export type RemoveFromGroupOutput = z.infer<typeof RemoveFromGroupOutputSchema>;
