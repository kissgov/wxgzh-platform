/**
 * 内容创作模块 Zod 契约
 *
 * - InputSchema 严格对应 ContentController method 入参
 * - OutputSchema 对应 ContentService 实际返回结构 (service 是 source of truth)
 * - 覆盖文章 CRUD / 版本恢复 / 审批 / 分类 / 模板 / AI 生成
 *
 * 字段命名: camelCase (V1 风格)
 */
import { z } from 'zod';
import { PageQuerySchema } from './pagination.contract';

// ── 通用子 schema ────────────────────────────────────────────────────────

/** 分类简略信息 — service.getArticles.list[].category (select id+name) */
const CategoryBriefSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
});
export type CategoryBrief = z.infer<typeof CategoryBriefSchema>;

/** 文章版本快照 — Article.revisions 元素 */
const ArticleRevisionSchema = z.object({
  id: z.string().min(1),
  articleId: z.string().min(1),
  version: z.number().int().positive(),
  title: z.string(),
  content: z.string().nullable(),
  digest: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type ArticleRevision = z.infer<typeof ArticleRevisionSchema>;

/** 文章(基础) — service.createArticle / updateArticle / submitForReview 实际返回 */
const ArticleBaseSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  authorizerId: z.string().min(1),
  title: z.string(),
  author: z.string().nullable(),
  digest: z.string().nullable(),
  content: z.string().nullable(),
  contentType: z.string(),
  coverMediaId: z.string().nullable(),
  coverUrl: z.string().nullable(),
  status: z.string(), // draft | pending_review | approved | published | failed
  scheduledAt: z.string().datetime().nullable(),
  publishedAt: z.string().datetime().nullable(),
  wechatMsgId: z.string().nullable(),
  categoryId: z.string().nullable(),
  tags: z.array(z.string()),
  version: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});
export type ArticleBase = z.infer<typeof ArticleBaseSchema>;

/** 文章(列表项) — service.getArticles.list 元素 (含 category brief) */
const ArticleListItemSchema = ArticleBaseSchema.extend({
  category: CategoryBriefSchema.nullable(),
});
export type ArticleListItem = z.infer<typeof ArticleListItemSchema>;

/** 文章(详情) — service.getArticle 实际返回 (含 category + revisions) */
const ArticleDetailSchema = ArticleBaseSchema.extend({
  category: CategoryBriefSchema.nullable(),
  revisions: z.array(ArticleRevisionSchema),
});
export type ArticleDetail = z.infer<typeof ArticleDetailSchema>;

/** 文章分类 — service.getCategories / createCategory 实际返回 (prisma.articleCategory) */
const ArticleCategorySchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  name: z.string(),
  sortOrder: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});
export type ArticleCategory = z.infer<typeof ArticleCategorySchema>;

/** 文章模板 — service.getTemplates / createTemplate 实际返回 (prisma.articleTemplate) */
const ArticleTemplateSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  name: z.string(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  content: z.string().nullable(),
  coverUrl: z.string().nullable(),
  usageCount: z.number().int().nonnegative(),
  isSystem: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});
export type ArticleTemplate = z.infer<typeof ArticleTemplateSchema>;

/** 空响应 (data: null) */
export const VoidResponseSchema = z.null();
export type VoidResponse = z.infer<typeof VoidResponseSchema>;

// ── Input schema ─────────────────────────────────────────────────────────

/** GET /articles — 文章列表查询
 *  - page_size V1 默认 20,与 PageQuerySchema 默认一致,无需覆盖
 *  - status 枚举对齐 prisma.article.status
 */
export const ListArticlesQuerySchema = PageQuerySchema.extend({
  status: z
    .enum(['draft', 'pending_review', 'approved', 'published', 'failed'])
    .optional(),
  categoryId: z.string().optional(),
  keyword: z.string().optional(),
});
export type ListArticlesQuery = z.infer<typeof ListArticlesQuerySchema>;

/** POST /articles — 创建文章
 *  - 必填:title
 *  - 字段从 service.createArticle.prisma.article.create({ data }) 推断
 *  - tags / content / scheduledAt 有默认值 (空数组 / 空串 / null)
 */
export const CreateArticleInputSchema = z.object({
  title: z.string().min(1, '请填写文章标题'),
  author: z.string().optional(),
  digest: z.string().optional(),
  content: z.string().optional(),
  coverUrl: z.string().optional(),
  categoryId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  scheduledAt: z.string().optional(),
});
export type CreateArticleInput = z.infer<typeof CreateArticleInputSchema>;

/** PUT /articles/:id — 编辑文章 (partial) */
export const UpdateArticleInputSchema = z.object({
  title: z.string().min(1).optional(),
  author: z.string().optional(),
  digest: z.string().optional(),
  content: z.string().optional(),
  coverUrl: z.string().optional(),
  categoryId: z.string().optional(),
  tags: z.array(z.string()).optional(),
});
export type UpdateArticleInput = z.infer<typeof UpdateArticleInputSchema>;

/** POST /articles/categories — 创建文章分类 */
export const CreateCategoryInputSchema = z.object({
  name: z.string().min(1, '请填写分类名称'),
});
export type CreateCategoryInput = z.infer<typeof CreateCategoryInputSchema>;

/** POST /articles/templates — 创建文章模板 */
export const CreateTemplateInputSchema = z.object({
  name: z.string().min(1, '请填写模板名称'),
  description: z.string().optional(),
  category: z.string().optional(),
  content: z.string().optional(),
  coverUrl: z.string().optional(),
});
export type CreateTemplateInput = z.infer<typeof CreateTemplateInputSchema>;

/** POST /articles/ai/generate — AI 内容生成入参
 *  - 必填:prompt
 *  - type 枚举对齐 V1 DTO
 */
export const AiGenerateInputSchema = z.object({
  prompt: z.string().min(1, '请填写提示词'),
  type: z.enum(['article', 'outline', 'rewrite', 'expand', 'summarize']).default('article'),
  context: z.string().optional(),
});
export type AiGenerateInput = z.infer<typeof AiGenerateInputSchema>;

// ── Output schema ────────────────────────────────────────────────────────

/** GET /articles — service.getArticles 分页 */
export const ListArticlesOutputSchema = z.object({
  list: z.array(ArticleListItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  page_size: z.number().int().positive(),
});
export type ListArticlesOutput = z.infer<typeof ListArticlesOutputSchema>;

/** GET /articles/:id — service.getArticle */
export const GetArticleOutputSchema = ArticleDetailSchema;
export type GetArticleOutput = z.infer<typeof GetArticleOutputSchema>;

/** POST /articles — service.createArticle */
export const CreateArticleOutputSchema = ArticleBaseSchema;
export type CreateArticleOutput = z.infer<typeof CreateArticleOutputSchema>;

/** PUT /articles/:id — service.updateArticle */
export const UpdateArticleOutputSchema = ArticleBaseSchema;
export type UpdateArticleOutput = z.infer<typeof UpdateArticleOutputSchema>;

/** POST /articles/:id/revisions/:revId/restore — service.restoreRevision (复用 updateArticle) */
export const RestoreRevisionOutputSchema = ArticleBaseSchema;
export type RestoreRevisionOutput = z.infer<typeof RestoreRevisionOutputSchema>;

/** POST /articles/:id/submit-review — service.submitForReview */
export const SubmitReviewOutputSchema = ArticleBaseSchema;
export type SubmitReviewOutput = z.infer<typeof SubmitReviewOutputSchema>;

/** GET /articles/categories/list — service.getCategories 数组 */
export const ListCategoriesOutputSchema = z.array(ArticleCategorySchema);
export type ListCategoriesOutput = z.infer<typeof ListCategoriesOutputSchema>;

/** POST /articles/categories — service.createCategory */
export const CreateCategoryOutputSchema = ArticleCategorySchema;
export type CreateCategoryOutput = z.infer<typeof CreateCategoryOutputSchema>;

/** GET /articles/templates/list — service.getTemplates 数组 */
export const ListTemplatesOutputSchema = z.array(ArticleTemplateSchema);
export type ListTemplatesOutput = z.infer<typeof ListTemplatesOutputSchema>;

/** POST /articles/templates — service.createTemplate */
export const CreateTemplateOutputSchema = ArticleTemplateSchema;
export type CreateTemplateOutput = z.infer<typeof CreateTemplateOutputSchema>;

/** POST /articles/templates/:templateId/apply — service.applyTemplate (复用 createArticle) */
export const ApplyTemplateOutputSchema = ArticleBaseSchema;
export type ApplyTemplateOutput = z.infer<typeof ApplyTemplateOutputSchema>;

/** POST /articles/ai/generate — V1 controller 内联返回 { content: string } */
export const AiGenerateOutputSchema = z.object({
  content: z.string(),
});
export type AiGenerateOutput = z.infer<typeof AiGenerateOutputSchema>;

/** DELETE 共用 — service.deleteXxx 返回 { deleted: true } */
export const DeleteOutputSchema = z.object({
  deleted: z.literal(true),
});
export type DeleteOutput = z.infer<typeof DeleteOutputSchema>;
