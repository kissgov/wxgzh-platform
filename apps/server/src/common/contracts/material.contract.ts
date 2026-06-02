/**
 * 素材管理模块 Zod 契约
 *
 * - InputSchema 严格对应 MaterialController method 入参
 * - OutputSchema 对应 MaterialService 实际返回结构 (service 是 source of truth)
 * - 覆盖素材列表/详情/上传/编辑/删除/分类聚合
 *
 * 字段命名: camelCase (V1 风格)
 */
import { z } from 'zod';
import { PageQuerySchema } from './pagination.contract';

// ── 通用子 schema ────────────────────────────────────────────────────────

/** 素材(基础) — service.getMaterials 列表项 / updateMaterial / createMaterial 实际返回 */
const MaterialBaseSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  authorizerId: z.string().nullable(),
  type: z.string(), // image | voice | video | thumb | news
  name: z.string(),
  mediaId: z.string().nullable(),
  url: z.string(),
  thumbUrl: z.string().nullable(),
  fileSize: z.number().int().nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  duration: z.number().int().nullable(),
  format: z.string().nullable(),
  category: z.string(),
  tags: z.array(z.string()),
  usageCount: z.number().int().nonnegative(),
  isSynced: z.boolean(),
  syncedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});
export type MaterialBase = z.infer<typeof MaterialBaseSchema>;

/** 素材使用日志 — Material.usageLogs 关联 (service.getMaterialDetail) */
const MaterialUsageLogSchema = z.object({
  id: z.string().min(1),
  materialId: z.string().min(1),
  usedIn: z.string(), // auto_reply | broadcast | menu | news
  usedById: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type MaterialUsageLog = z.infer<typeof MaterialUsageLogSchema>;

/** 素材详情(含 usageLogs) — service.getMaterialDetail */
const MaterialDetailSchema = MaterialBaseSchema.extend({
  usageLogs: z.array(MaterialUsageLogSchema),
});
export type MaterialDetail = z.infer<typeof MaterialDetailSchema>;

/** 素材分类聚合项 — service.getCategories */
const MaterialCategoryItemSchema = z.object({
  category: z.string(),
  count: z.number().int().nonnegative(),
});
export type MaterialCategoryItem = z.infer<typeof MaterialCategoryItemSchema>;

/** 空响应 (data: null) */
export const VoidResponseSchema = z.null();
export type VoidResponse = z.infer<typeof VoidResponseSchema>;

// ── Input schema ─────────────────────────────────────────────────────────

/** GET /materials — 素材列表查询 (复用 PageQuerySchema + 扩展)
 *  - page_size V1 默认 20,与 PageQuerySchema 默认一致,无需覆盖
 *  - 保留 V1 type / category / keyword / tags 过滤
 */
export const ListMaterialsQuerySchema = PageQuerySchema.extend({
  type: z.enum(['image', 'voice', 'video', 'thumb', 'news']).optional(),
  category: z.string().optional(),
  keyword: z.string().optional(),
  tags: z.array(z.string()).optional(),
});
export type ListMaterialsQuery = z.infer<typeof ListMaterialsQuerySchema>;

/** PUT /materials/:materialId — 编辑素材信息 (partial) */
export const UpdateMaterialInputSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
});
export type UpdateMaterialInput = z.infer<typeof UpdateMaterialInputSchema>;

// ── Output schema ────────────────────────────────────────────────────────

/** GET /materials — service.getMaterials 分页 */
export const ListMaterialsOutputSchema = z.object({
  list: z.array(MaterialBaseSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  page_size: z.number().int().positive(),
});
export type ListMaterialsOutput = z.infer<typeof ListMaterialsOutputSchema>;

/** GET /materials/categories — service.getCategories 数组 */
export const ListMaterialCategoriesOutputSchema = z.array(MaterialCategoryItemSchema);
export type ListMaterialCategoriesOutput = z.infer<typeof ListMaterialCategoriesOutputSchema>;

/** GET /materials/:materialId — service.getMaterialDetail */
export const GetMaterialDetailOutputSchema = MaterialDetailSchema;
export type GetMaterialDetailOutput = z.infer<typeof GetMaterialDetailOutputSchema>;

/** POST /materials/upload — service.createMaterial 实际返回 */
export const UploadMaterialOutputSchema = MaterialBaseSchema;
export type UploadMaterialOutput = z.infer<typeof UploadMaterialOutputSchema>;

/** PUT /materials/:materialId — service.updateMaterial 实际返回 */
export const UpdateMaterialOutputSchema = MaterialBaseSchema;
export type UpdateMaterialOutput = z.infer<typeof UpdateMaterialOutputSchema>;

/** DELETE /materials/:materialId — service.deleteMaterial 返回 { deleted: true } */
export const DeleteMaterialOutputSchema = z.object({
  deleted: z.literal(true),
});
export type DeleteMaterialOutput = z.infer<typeof DeleteMaterialOutputSchema>;
