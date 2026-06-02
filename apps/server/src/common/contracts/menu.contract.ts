/**
 * 菜单管理模块 Zod 契约
 *
 * - InputSchema 严格对应 MenuController method 入参
 * - OutputSchema 对应 MenuService 实际返回结构 (service 是 source of truth)
 * - 覆盖菜单当前/草稿/保存/发布/历史/模板 CRUD/应用模板
 *
 * 字段命名: camelCase (V1 风格)
 */
import { z } from 'zod';

// ── 通用子 schema ────────────────────────────────────────────────────────

/** 菜单配置 — service.getCurrentMenu / getDraftMenu / saveDraft / publishMenu / applyTemplate 直接返回 */
const MenuConfigSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  authorizerId: z.string().min(1),
  version: z.number().int().nonnegative(),
  menuJson: z.unknown(), // JSONB
  status: z.string(), // draft | published
  publishedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type MenuConfig = z.infer<typeof MenuConfigSchema>;

/** 空草稿兜底 — V1 controller 在 getDraftMenu 为 null 时返回 { menuJson: { button: [] } } */
const EmptyDraftSchema = z.object({
  menuJson: z.object({
    button: z.array(z.unknown()),
  }),
});
export type EmptyDraft = z.infer<typeof EmptyDraftSchema>;

/** 菜单模板 — service.getTemplates / createTemplate 直接返回 prisma.menuTemplate */
const MenuTemplateSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  name: z.string(),
  description: z.string().nullable(),
  menuJson: z.unknown(), // JSONB
  category: z.string().nullable(),
  usageCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});
export type MenuTemplate = z.infer<typeof MenuTemplateSchema>;

/** 菜单发布历史 — service.getPublishHistory.list 元素 (无 include) */
const MenuPublishHistorySchema = z.object({
  id: z.string().min(1),
  menuConfigId: z.string().min(1),
  version: z.number().int().nonnegative(),
  menuJson: z.unknown(), // JSONB
  publishedBy: z.string().min(1),
  publishedAt: z.string().datetime(),
});
export type MenuPublishHistory = z.infer<typeof MenuPublishHistorySchema>;

/** 空响应 (data: null) */
export const VoidResponseSchema = z.null();
export type VoidResponse = z.infer<typeof VoidResponseSchema>;

// ── Input schema ─────────────────────────────────────────────────────────

/** POST /menu — 保存菜单草稿 */
export const SaveMenuInputSchema = z.object({
  menuJson: z.record(z.string(), z.unknown()),
});
export type SaveMenuInput = z.infer<typeof SaveMenuInputSchema>;

/** POST /menu/templates — 保存为模板 */
export const CreateMenuTemplateInputSchema = z.object({
  name: z.string().min(1, '请填写模板名称'),
  description: z.string().optional(),
  menuJson: z.record(z.string(), z.unknown()),
  category: z.string().optional(),
});
export type CreateMenuTemplateInput = z.infer<typeof CreateMenuTemplateInputSchema>;

// ── Output schema ────────────────────────────────────────────────────────

/** GET /menu/current — service.getCurrentMenu 可能为 null */
export const GetCurrentMenuOutputSchema = MenuConfigSchema.nullable();
export type GetCurrentMenuOutput = z.infer<typeof GetCurrentMenuOutputSchema>;

/** GET /menu/draft — service.getDraftMenu 或兜底 { menuJson: { button: [] } } */
export const GetDraftMenuOutputSchema = z.union([MenuConfigSchema, EmptyDraftSchema]);
export type GetDraftMenuOutput = z.infer<typeof GetDraftMenuOutputSchema>;

/** POST /menu — service.saveDraft */
export const SaveMenuOutputSchema = MenuConfigSchema;
export type SaveMenuOutput = z.infer<typeof SaveMenuOutputSchema>;

/** POST /menu/publish — service.publishMenu 标记草稿为已发布后的对象 */
export const PublishMenuOutputSchema = MenuConfigSchema;
export type PublishMenuOutput = z.infer<typeof PublishMenuOutputSchema>;

/** GET /menu/history — service.getPublishHistory 分页 */
export const GetPublishHistoryOutputSchema = z.object({
  list: z.array(MenuPublishHistorySchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  page_size: z.number().int().positive(),
});
export type GetPublishHistoryOutput = z.infer<typeof GetPublishHistoryOutputSchema>;

/** GET /menu/templates — service.getTemplates 数组 */
export const ListMenuTemplatesOutputSchema = z.array(MenuTemplateSchema);
export type ListMenuTemplatesOutput = z.infer<typeof ListMenuTemplatesOutputSchema>;

/** POST /menu/templates — service.createTemplate */
export const CreateMenuTemplateOutputSchema = MenuTemplateSchema;
export type CreateMenuTemplateOutput = z.infer<typeof CreateMenuTemplateOutputSchema>;

/** DELETE /menu/templates/:templateId — service.deleteTemplate 返回 { deleted: true } */
export const DeleteMenuTemplateOutputSchema = z.object({
  deleted: z.literal(true),
});
export type DeleteMenuTemplateOutput = z.infer<typeof DeleteMenuTemplateOutputSchema>;

/** POST /menu/templates/:templateId/apply — service.applyTemplate (复用 saveDraft) */
export const ApplyMenuTemplateOutputSchema = MenuConfigSchema;
export type ApplyMenuTemplateOutput = z.infer<typeof ApplyMenuTemplateOutputSchema>;
