/**
 * 数据统计模块 Zod 契约
 *
 * - InputSchema 严格对应 AnalyticsController method 入参
 * - OutputSchema 对应 AnalyticsService 实际返回结构 (service 是 source of truth)
 * - 覆盖看板概览 / 粉丝趋势 / 消息趋势 / 图文分析 / 转化漏斗 / RFM 分段
 *
 * 字段命名: camelCase (V1 风格)
 */
import { z } from 'zod';
import { PageQuerySchema } from './pagination.contract';

// ── 通用子 schema ────────────────────────────────────────────────────────

/** 漏斗步骤 (JSONB 数组元素) — service.createFunnel 接受 / service.getFunnelData 读取 */
const FunnelStepSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  eventType: z.string().min(1),
});
export type FunnelStep = z.infer<typeof FunnelStepSchema>;

/** 转化漏斗(完整记录) — service.getFunnels / createFunnel 直接返回 prisma.conversionFunnel */
const FunnelBaseSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  authorizerId: z.string().min(1),
  name: z.string(),
  description: z.string().nullable(),
  steps: z.array(FunnelStepSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});
export type FunnelBase = z.infer<typeof FunnelBaseSchema>;

/** 漏斗步骤转化数据 — service.getFunnelData.data 元素 */
const FunnelDataItemSchema = z.object({
  name: z.string(),
  value: z.number().int().nonnegative(),
  rate: z.string(), // "100%" | "50.0%"
});
export type FunnelDataItem = z.infer<typeof FunnelDataItemSchema>;

/** 漏斗数据(含 funnel 主体 + 各步数据) — service.getFunnelData (可能为 null) */
const FunnelDataSchema = z.object({
  funnel: FunnelBaseSchema,
  data: z.array(FunnelDataItemSchema),
});
export type FunnelData = z.infer<typeof FunnelDataSchema>;

/** 粉丝趋势汇总 — service.getFollowerTrend.summary */
const FollowerTrendSummarySchema = z.object({
  totalFollowers: z.number().int().nonnegative(),
  newSubscribers: z.number().int().nonnegative(),
  unsubscribers: z.number().int().nonnegative(),
  netGrowth: z.number().int(),
});

/** 粉丝趋势时序点 — service.getFollowerTrend.series 元素 */
const FollowerTrendPointSchema = z.object({
  date: z.string(), // YYYY-MM-DD
  newSubs: z.number().int().nonnegative(),
  unsubs: z.number().int().nonnegative(),
  net: z.number().int(),
  total: z.number().int().nonnegative(),
});

/** 消息趋势汇总(含 replyRate 比例) — service.getMessageTrend.summary */
const MessageTrendSummarySchema = z.object({
  sent: z.number().int().nonnegative(),
  received: z.number().int().nonnegative(),
  replied: z.number().int().nonnegative(),
  replyRate: z.number().min(0).max(1),
});

/** 消息趋势时序点 — service.getMessageTrend.series 元素 */
const MessageTrendPointSchema = z.object({
  date: z.string(),
  sent: z.number().int().nonnegative(),
  received: z.number().int().nonnegative(),
  replied: z.number().int().nonnegative(),
  replyRate: z.number().min(0).max(1),
});

/** RFM 分段项 — service.getRfmOverview 元素 */
const RfmSegmentItemSchema = z.object({
  segment: z.string(), // champions | loyal | potential | at_risk | lost
  label: z.string(),
  count: z.number().int().nonnegative(),
});
export type RfmSegmentItem = z.infer<typeof RfmSegmentItemSchema>;

/** 空响应 (data: null) */
export const VoidResponseSchema = z.null();
export type VoidResponse = z.infer<typeof VoidResponseSchema>;

// ── Input schema ─────────────────────────────────────────────────────────

/** GET /dashboard/news — 图文分析列表
 *  - page_size V1 默认 20,与 PageQuerySchema 默认一致,无需覆盖
 *  - 注意:V1 controller.news 仅接 page 单参数,这里扩展完整分页以保持一致性
 */
export const ListNewsAnalysisQuerySchema = PageQuerySchema.extend({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});
export type ListNewsAnalysisQuery = z.infer<typeof ListNewsAnalysisQuerySchema>;

/** POST /dashboard/funnels — 创建漏斗 (替代 V1 body: any)
 *  - 字段从 service.createFunnel 参数类型 {name, description?, steps[]} 推断
 *  - steps 元素结构从 getFunnelData 使用 {key, label, eventType} 推断
 */
export const CreateFunnelInputSchema = z.object({
  name: z.string().min(1, '请填写漏斗名称'),
  description: z.string().optional(),
  steps: z.array(FunnelStepSchema).min(1, '请至少添加一个步骤'),
});
export type CreateFunnelInput = z.infer<typeof CreateFunnelInputSchema>;

// ── Output schema ────────────────────────────────────────────────────────

/** GET /dashboard/overview — service.getOverview */
export const OverviewOutputSchema = z.object({
  totalFollowers: z.number().int().nonnegative(),
  last30Days: z.object({
    newSubscribers: z.number().int().nonnegative(),
    unsubscribers: z.number().int().nonnegative(),
    netGrowth: z.number().int(),
  }),
  messages: z.object({
    sent: z.number().int().nonnegative(),
    received: z.number().int().nonnegative(),
  }),
});
export type OverviewOutput = z.infer<typeof OverviewOutputSchema>;

/** GET /dashboard/followers/trend — service.getFollowerTrend */
export const FollowerTrendOutputSchema = z.object({
  summary: FollowerTrendSummarySchema,
  series: z.array(FollowerTrendPointSchema),
});
export type FollowerTrendOutput = z.infer<typeof FollowerTrendOutputSchema>;

/** GET /dashboard/messages/trend — service.getMessageTrend */
export const MessageTrendOutputSchema = z.object({
  summary: MessageTrendSummarySchema,
  series: z.array(MessageTrendPointSchema),
});
export type MessageTrendOutput = z.infer<typeof MessageTrendOutputSchema>;

/** GET /dashboard/news — service.getNewsAnalysis 分页 (元素为 prisma.newsStat 原样) */
export const ListNewsAnalysisOutputSchema = z.object({
  list: z.array(z.record(z.string(), z.unknown())),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  page_size: z.number().int().positive(),
});
export type ListNewsAnalysisOutput = z.infer<typeof ListNewsAnalysisOutputSchema>;

/** GET /dashboard/funnels — service.getFunnels 数组 */
export const ListFunnelsOutputSchema = z.array(FunnelBaseSchema);
export type ListFunnelsOutput = z.infer<typeof ListFunnelsOutputSchema>;

/** POST /dashboard/funnels — service.createFunnel */
export const CreateFunnelOutputSchema = FunnelBaseSchema;
export type CreateFunnelOutput = z.infer<typeof CreateFunnelOutputSchema>;

/** GET /dashboard/funnels/:id/data — service.getFunnelData 可能为 null */
export const GetFunnelDataOutputSchema = FunnelDataSchema.nullable();
export type GetFunnelDataOutput = z.infer<typeof GetFunnelDataOutputSchema>;

/** GET /dashboard/rfm/overview — service.getRfmOverview 数组 */
export const ListRfmSegmentsOutputSchema = z.array(RfmSegmentItemSchema);
export type ListRfmSegmentsOutput = z.infer<typeof ListRfmSegmentsOutputSchema>;

/** POST /dashboard/rfm/compute — service.computeRfm 返回 { processed: n } */
export const ComputeRfmOutputSchema = z.object({
  processed: z.number().int().nonnegative(),
});
export type ComputeRfmOutput = z.infer<typeof ComputeRfmOutputSchema>;
