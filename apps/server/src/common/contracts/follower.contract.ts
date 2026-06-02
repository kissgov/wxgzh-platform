/**
 * 粉丝管理模块 Zod 契约
 *
 * - InputSchema 严格对应 FollowerController method 入参
 * - OutputSchema 对应 FollowerService 实际返回结构 (service 是 source of truth)
 * - 覆盖粉丝列表/详情 / 标签 CRUD / 批量打/移标签 / 标签规则 CRUD+执行 / 黑名单 / 粉丝画像
 *
 * 字段命名: camelCase (V1 风格)
 */
import { z } from 'zod';
import { PageQuerySchema } from './pagination.contract';

// ── 通用子 schema ────────────────────────────────────────────────────────

/** 标签简略信息 — Follower.tags / TagRule.targetTag 关联 */
const TagBriefSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  color: z.string().nullable(),
});
export type TagBrief = z.infer<typeof TagBriefSchema>;

/** 粉丝(含 tags 扁平化) — service.getFollowers 列表项 / service.getFollowerDetail */
const FollowerSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  authorizerId: z.string().min(1),
  openid: z.string().min(1),
  unionid: z.string().nullable(),
  nickname: z.string().nullable(),
  headImg: z.string().nullable(),
  sex: z.number().int().nullable(),
  country: z.string().nullable(),
  province: z.string().nullable(),
  city: z.string().nullable(),
  subscribe: z.boolean(),
  subscribeAt: z.string().datetime().nullable(),
  unsubscribeAt: z.string().datetime().nullable(),
  subscribeScene: z.string().nullable(),
  qrScene: z.string().nullable(),
  qrSceneStr: z.string().nullable(),
  interactCount: z.number().int().nonnegative(),
  lastInteractAt: z.string().datetime().nullable(),
  remark: z.string().nullable(),
  extra: z.unknown().nullable(),
  syncedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
  tags: z.array(TagBriefSchema),
});
export type Follower = z.infer<typeof FollowerSchema>;

/** 粉丝标签(完整记录) — service.getTags / createTag / updateTag 直接返回 prisma.followerTag */
const FollowerTagSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  authorizerId: z.string().min(1),
  wechatTagId: z.number().int().nullable(),
  name: z.string(),
  color: z.string().nullable(),
  isSystem: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});
export type FollowerTag = z.infer<typeof FollowerTagSchema>;

/** 标签规则条件 (JSONB 数组元素) */
const TagRuleConditionSchema = z.object({
  field: z.string().min(1),
  operator: z.string().min(1),
  value: z.unknown(),
});
export type TagRuleCondition = z.infer<typeof TagRuleConditionSchema>;

/** 标签规则(基础) — service.createTagRule / updateTagRule 直接返回 prisma.tagRule (无 include) */
const TagRuleBaseSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  authorizerId: z.string().min(1),
  name: z.string(),
  description: z.string().nullable(),
  conditions: z.unknown(), // JSONB
  logic: z.string(),
  targetTagId: z.string().min(1),
  status: z.string(),
  lastExecAt: z.string().datetime().nullable(),
  lastExecCount: z.number().int().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});
export type TagRuleBase = z.infer<typeof TagRuleBaseSchema>;

/** 标签规则(含 targetTag 关联) — service.getTagRules */
const TagRuleSchema = TagRuleBaseSchema.extend({
  targetTag: TagBriefSchema,
});
export type TagRule = z.infer<typeof TagRuleSchema>;

/** 黑名单粉丝简略信息 — Blacklist.follower 关联 */
const BlacklistFollowerBriefSchema = z.object({
  id: z.string().min(1),
  openid: z.string().min(1),
  nickname: z.string().nullable(),
  headImg: z.string().nullable(),
});
export type BlacklistFollowerBrief = z.infer<typeof BlacklistFollowerBriefSchema>;

/** 黑名单记录(完整) — service.addToBlacklist 直接返回 prisma.blacklist */
const BlacklistSchema = z.object({
  id: z.string().min(1),
  authorizerId: z.string().min(1),
  followerId: z.string().min(1),
  reason: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type Blacklist = z.infer<typeof BlacklistSchema>;

/** 黑名单列表项(含 follower 关联) — service.getBlacklist */
const BlacklistItemSchema = BlacklistSchema.extend({
  follower: BlacklistFollowerBriefSchema,
});
export type BlacklistItem = z.infer<typeof BlacklistItemSchema>;

/** 画像区域分布项 — service.getPortrait.region */
const PortraitRegionItemSchema = z.object({
  province: z.string().min(1),
  count: z.number().int().nonnegative(),
});

/** 画像性别分布(比例 0-1) — service.getPortrait.gender */
const PortraitGenderSchema = z.object({
  male: z.number().min(0).max(1),
  female: z.number().min(0).max(1),
  unknown: z.number().min(0).max(1),
});

/** 空响应 (data: null) */
export const VoidResponseSchema = z.null();
export type VoidResponse = z.infer<typeof VoidResponseSchema>;

// ── Input schema ─────────────────────────────────────────────────────────

/** GET /followers — 粉丝列表查询 (复用 PageQuerySchema + 扩展) */
export const ListFollowersQuerySchema = PageQuerySchema.extend({
  tagId: z.string().min(1).optional(),
  keyword: z.string().optional(),
  sex: z.enum(['1', '2']).optional(),
  province: z.string().optional(),
  subscribeSince: z.string().optional(),
  subscribeUntil: z.string().optional(),
});
export type ListFollowersQuery = z.infer<typeof ListFollowersQuerySchema>;

/** POST /followers/tags — 创建标签 */
export const CreateTagInputSchema = z.object({
  name: z.string().min(1, '请填写标签名称'),
  color: z.string().optional(),
});
export type CreateTagInput = z.infer<typeof CreateTagInputSchema>;

/** PUT /followers/tags/:tagId — 编辑标签 (partial of Create) */
export const UpdateTagInputSchema = CreateTagInputSchema.partial();
export type UpdateTagInput = z.infer<typeof UpdateTagInputSchema>;

/** POST /followers/tags/batch — 批量打标签 (followerIds + tagIds) */
export const BatchTagInputSchema = z.object({
  followerIds: z.array(z.string().min(1)).min(1, '请至少选择一个粉丝').max(1000, '单次最多 1000 个粉丝'),
  tagIds: z.array(z.string().min(1)).min(1, '请至少选择一个标签'),
});
export type BatchTagInput = z.infer<typeof BatchTagInputSchema>;

/** DELETE /followers/tags/batch — 批量移除标签 (复用 BatchTag 同 DTO) */
export const BatchUntagInputSchema = BatchTagInputSchema;
export type BatchUntagInput = z.infer<typeof BatchUntagInputSchema>;

/** POST /followers/tags/rules — 创建标签规则 */
export const CreateTagRuleInputSchema = z.object({
  name: z.string().min(1, '请填写规则名称'),
  description: z.string().optional(),
  conditions: z.array(TagRuleConditionSchema).min(1, '请至少添加一个条件'),
  logic: z.enum(['AND', 'OR']).default('AND'),
  targetTagId: z.string().min(1, '请选择目标标签'),
});
export type CreateTagRuleInput = z.infer<typeof CreateTagRuleInputSchema>;

/** PUT /followers/tags/rules/:ruleId — 编辑标签规则 (partial of Create + status) */
export const UpdateTagRuleInputSchema = CreateTagRuleInputSchema.partial().extend({
  status: z.enum(['enabled', 'disabled']).optional(),
});
export type UpdateTagRuleInput = z.infer<typeof UpdateTagRuleInputSchema>;

// ── Output schema ────────────────────────────────────────────────────────

/** GET /followers — service.getFollowers 分页 */
export const ListFollowersOutputSchema = z.object({
  list: z.array(FollowerSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  page_size: z.number().int().positive(),
});
export type ListFollowersOutput = z.infer<typeof ListFollowersOutputSchema>;

/** GET /followers/:followerId — service.getFollowerDetail */
export const GetFollowerDetailOutputSchema = FollowerSchema;
export type GetFollowerDetailOutput = z.infer<typeof GetFollowerDetailOutputSchema>;

/** GET /followers/tags/list — service.getTags 数组 */
export const ListTagsOutputSchema = z.array(FollowerTagSchema);
export type ListTagsOutput = z.infer<typeof ListTagsOutputSchema>;

/** POST /followers/tags — service.createTag */
export const CreateTagOutputSchema = FollowerTagSchema;
export type CreateTagOutput = z.infer<typeof CreateTagOutputSchema>;

/** PUT /followers/tags/:tagId — service.updateTag */
export const UpdateTagOutputSchema = FollowerTagSchema;
export type UpdateTagOutput = z.infer<typeof UpdateTagOutputSchema>;

/** POST /followers/tags/batch — service.batchTag */
export const BatchTagOutputSchema = z.object({
  success: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});
export type BatchTagOutput = z.infer<typeof BatchTagOutputSchema>;

/** DELETE /followers/tags/batch — service.batchUntag */
export const BatchUntagOutputSchema = z.object({
  removed: z.number().int().nonnegative(),
});
export type BatchUntagOutput = z.infer<typeof BatchUntagOutputSchema>;

/** GET /followers/tags/rules — service.getTagRules 数组 */
export const ListTagRulesOutputSchema = z.array(TagRuleSchema);
export type ListTagRulesOutput = z.infer<typeof ListTagRulesOutputSchema>;

/** POST /followers/tags/rules — service.createTagRule */
export const CreateTagRuleOutputSchema = TagRuleBaseSchema;
export type CreateTagRuleOutput = z.infer<typeof CreateTagRuleOutputSchema>;

/** PUT /followers/tags/rules/:ruleId — service.updateTagRule */
export const UpdateTagRuleOutputSchema = TagRuleBaseSchema;
export type UpdateTagRuleOutput = z.infer<typeof UpdateTagRuleOutputSchema>;

/** POST /followers/tags/rules/:ruleId/execute — service.executeTagRule */
export const ExecuteTagRuleOutputSchema = z.object({
  affected: z.number().int().nonnegative(),
  tagged: z.number().int().nonnegative(),
});
export type ExecuteTagRuleOutput = z.infer<typeof ExecuteTagRuleOutputSchema>;

/** GET /followers/blacklist — service.getBlacklist 分页 */
export const GetBlacklistOutputSchema = z.object({
  list: z.array(BlacklistItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  page_size: z.number().int().positive(),
});
export type GetBlacklistOutput = z.infer<typeof GetBlacklistOutputSchema>;

/** POST /followers/:followerId/blacklist — service.addToBlacklist */
export const AddToBlacklistOutputSchema = BlacklistSchema;
export type AddToBlacklistOutput = z.infer<typeof AddToBlacklistOutputSchema>;

/** GET /followers/portrait/stats — service.getPortrait */
export const GetPortraitOutputSchema = z.object({
  totalFollowers: z.number().int().nonnegative(),
  gender: PortraitGenderSchema,
  region: z.array(PortraitRegionItemSchema),
});
export type GetPortraitOutput = z.infer<typeof GetPortraitOutputSchema>;
