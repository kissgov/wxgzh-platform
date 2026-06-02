/**
 * LLM 模块 Zod 契约
 *
 * - InputSchema 严格对应 LlmController method 入参
 * - OutputSchema 对应 LlmService 实际返回结构 (service 是 source of truth)
 * - 覆盖 LLM 配置 CRUD / 用量统计 / 用量日志 / AI 内容生成 / AI 智能回复 / AI 定时创作 / AI 周报
 *
 * 字段命名: camelCase (V1 风格)
 */
import { z } from 'zod';
import { PageQuerySchema } from './pagination.contract';

// ── 通用子 schema ────────────────────────────────────────────────────────

/** LLM 配置 — service.getConfig / upsertConfig 实际返回 (prisma.llmConfig)
 *  - apiKey 在 getConfig 中被脱敏为 '****xxxx' 或 null
 *  - upsertConfig 返回的 apiKey 是真实密钥,响应给前端时由 controller 进一步处理
 */
const LlmConfigSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  provider: z.string(), // openai | claude | deepseek | qwen | local
  apiKey: z.string().nullable(),
  apiUrl: z.string().nullable(),
  model: z.string(),
  temperature: z.number(),
  maxTokens: z.number().int(),
  systemPrompt: z.string().nullable(),
  dailyLimit: z.number().int(),
  status: z.string(), // active | disabled
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type LlmConfig = z.infer<typeof LlmConfigSchema>;

/** 默认 LLM 配置 — controller 在 service.getConfig 返回 null 时使用
 *  - 只含 V1 controller 内联默认值的 6 个字段
 */
const DefaultLlmConfigSchema = z.object({
  provider: z.string(),
  model: z.string(),
  temperature: z.number(),
  maxTokens: z.number().int(),
  dailyLimit: z.number().int(),
  status: z.string(),
});
export type DefaultLlmConfig = z.infer<typeof DefaultLlmConfigSchema>;

/** LLM 用量日志 — service.getUsageLogs.list[] 元素 (prisma.llmUsageLog) */
const LlmUsageLogSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  configId: z.string().min(1),
  scene: z.string(),
  prompt: z.string().nullable(),
  completion: z.string().nullable(),
  model: z.string(),
  tokensIn: z.number().int().nonnegative(),
  tokensOut: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
  status: z.string(), // success | error
  errorMsg: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type LlmUsageLog = z.infer<typeof LlmUsageLogSchema>;

/** 文章草稿 (生成结果) — service.generateScheduledArticle 实际返回 (prisma.article.create)
 *  - 仅含 AI 创作路径可能设置的字段,完整 Article 模型见 content.contract
 */
const ScheduledArticleSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  authorizerId: z.string().min(1),
  title: z.string(),
  author: z.string().nullable(),
  digest: z.string().nullable(),
  content: z.string().nullable(),
  contentType: z.string(),
  status: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});
export type ScheduledArticle = z.infer<typeof ScheduledArticleSchema>;

/** 空响应 (data: null) */
export const VoidResponseSchema = z.null();
export type VoidResponse = z.infer<typeof VoidResponseSchema>;

// ── Input schema ─────────────────────────────────────────────────────────

/** PUT /admin/llm-config — 更新 LLM 配置
 *  - 所有字段可选,service 内部补默认值
 *  - 字段从 service.upsertConfig 推断
 *  - provider / status 枚举对齐 prisma.llmConfig
 */
export const UpdateConfigInputSchema = z.object({
  provider: z.enum(['openai', 'claude', 'deepseek', 'qwen', 'local']).optional(),
  apiKey: z.string().optional(),
  apiUrl: z.string().optional(),
  model: z.string().optional(),
  temperature: z.number().optional(),
  maxTokens: z.number().int().positive().optional(),
  systemPrompt: z.string().optional(),
  dailyLimit: z.number().int().nonnegative().optional(),
  status: z.enum(['active', 'disabled']).optional(),
});
export type UpdateConfigInput = z.infer<typeof UpdateConfigInputSchema>;

/** POST /articles/ai/generate — AI 内容生成
 *  - 必填:prompt
 *  - type 自由字符串 (V1 内联 type?: string)
 */
export const AiGenerateInputSchema = z.object({
  prompt: z.string().min(1, '请填写提示词'),
  type: z.string().optional(),
  context: z.string().optional(),
});
export type AiGenerateInput = z.infer<typeof AiGenerateInputSchema>;

/** POST /llm/auto-reply — AI 智能回复
 *  - 必填:message
 */
export const AutoReplyInputSchema = z.object({
  message: z.string().min(1, '请填写粉丝消息'),
});
export type AutoReplyInput = z.infer<typeof AutoReplyInputSchema>;

/** POST /llm/scheduled-article — AI 定时创作文章
 *  - 必填:topic
 */
export const ScheduledArticleInputSchema = z.object({
  topic: z.string().min(1, '请填写文章主题'),
});
export type ScheduledArticleInput = z.infer<typeof ScheduledArticleInputSchema>;

/** POST /articles/ai/rewrite — AI 改写
 *  - 必填:content
 *  - style 可选
 */
export const AiRewriteInputSchema = z.object({
  content: z.string().min(1, '请填写原文'),
  style: z.string().optional(),
});
export type AiRewriteInput = z.infer<typeof AiRewriteInputSchema>;

// ── Output schema ────────────────────────────────────────────────────────

/** GET /admin/llm-config — service.getConfig 或默认配置
 *  - 真实配置 = LlmConfigSchema;默认 = DefaultLlmConfigSchema
 */
export const GetConfigOutputSchema = z.union([LlmConfigSchema, DefaultLlmConfigSchema]);
export type GetConfigOutput = z.infer<typeof GetConfigOutputSchema>;

/** PUT /admin/llm-config — service.upsertConfig 实际返回 (prisma.llmConfig) */
export const UpdateConfigOutputSchema = LlmConfigSchema;
export type UpdateConfigOutput = z.infer<typeof UpdateConfigOutputSchema>;

/** GET /admin/llm-stats — service.getUsageStats { today, total, limit } */
export const UsageStatsOutputSchema = z.object({
  today: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  limit: z.number().int().nonnegative(),
});
export type UsageStatsOutput = z.infer<typeof UsageStatsOutputSchema>;

/** GET /admin/llm-logs — service.getUsageLogs 分页
 *  - page_size V1 默认 20,与 PageQuerySchema 默认一致,无需覆盖
 *  - 当前 V1 只接 page,不接 page_size;这里 schema 保留 page_size 供后续扩展
 */
export const ListUsageLogsQuerySchema = PageQuerySchema.pick({ page: true, page_size: true });
export type ListUsageLogsQuery = z.infer<typeof ListUsageLogsQuerySchema>;

/** GET /admin/llm-logs — service.getUsageLogs 分页输出 */
export const ListUsageLogsOutputSchema = z.object({
  list: z.array(LlmUsageLogSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  page_size: z.number().int().positive(),
});
export type ListUsageLogsOutput = z.infer<typeof ListUsageLogsOutputSchema>;

/** POST /articles/ai/generate — V1 controller 内联返回 { content } */
export const AiGenerateOutputSchema = z.object({
  content: z.string(),
});
export type AiGenerateOutput = z.infer<typeof AiGenerateOutputSchema>;

/** POST /llm/auto-reply — V1 controller 内联返回 { reply } */
export const AutoReplyOutputSchema = z.object({
  reply: z.string(),
});
export type AutoReplyOutput = z.infer<typeof AutoReplyOutputSchema>;

/** POST /llm/scheduled-article — service.generateScheduledArticle 返回文章草稿 */
export const ScheduledArticleOutputSchema = ScheduledArticleSchema;
export type ScheduledArticleOutput = z.infer<typeof ScheduledArticleOutputSchema>;

/** POST /llm/weekly-report — service.generateWeeklyReport 返回 { summary, report } */
export const WeeklyReportOutputSchema = z.object({
  summary: z.string(),
  report: z.string(),
});
export type WeeklyReportOutput = z.infer<typeof WeeklyReportOutputSchema>;

/** POST /articles/ai/rewrite — V1 controller 内联返回 { content } */
export const AiRewriteOutputSchema = z.object({
  content: z.string(),
});
export type AiRewriteOutput = z.infer<typeof AiRewriteOutputSchema>;
