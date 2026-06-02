/**
 * 营销活动模块 Zod 契约
 *
 * - InputSchema 严格对应 CampaignController method 入参
 * - OutputSchema 对应 CampaignService 实际返回结构 (service 是 source of truth)
 * - 覆盖活动 CRUD / 状态流转 / 渠道二维码
 *
 * 字段命名: camelCase (V1 风格)
 */
import { z } from 'zod';
import { PageQuerySchema } from './pagination.contract';

// ── 通用子 schema ────────────────────────────────────────────────────────

/** 活动统计 (1:1 关联) — service.getCampaigns.list[].stats / service.getCampaign.stats */
const CampaignStatSchema = z.object({
  id: z.string().min(1),
  campaignId: z.string().min(1),
  impressions: z.number().int().nonnegative(),
  clicks: z.number().int().nonnegative(),
  conversions: z.number().int().nonnegative(),
  shares: z.number().int().nonnegative(),
  participants: z.number().int().nonnegative(),
  updatedAt: z.string().datetime(),
});
export type CampaignStat = z.infer<typeof CampaignStatSchema>;

/** 活动(基础) — service.createCampaign / updateCampaign / changeStatus 实际返回 */
const CampaignBaseSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  authorizerId: z.string().min(1),
  name: z.string(),
  type: z.string(), // h5_page | qrcode | referral
  description: z.string().nullable(),
  status: z.string(), // draft | active | paused | ended
  config: z.unknown().nullable(), // JSONB
  startAt: z.string().datetime().nullable(),
  endAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});
export type CampaignBase = z.infer<typeof CampaignBaseSchema>;

/** 活动(含 stats) — service.getCampaigns.list 元素 / service.getCampaign */
const CampaignWithStatsSchema = CampaignBaseSchema.extend({
  stats: CampaignStatSchema.nullable(),
});
export type CampaignWithStats = z.infer<typeof CampaignWithStatsSchema>;

/** 渠道二维码 — service.getQrCodes / createQrCode 实际返回 (prisma.channelQrCode) */
const ChannelQrCodeSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  authorizerId: z.string().min(1),
  campaignId: z.string().nullable(),
  name: z.string(),
  sceneStr: z.string(),
  ticket: z.string().nullable(),
  qrUrl: z.string().nullable(),
  expireAt: z.string().datetime().nullable(),
  scanCount: z.number().int().nonnegative(),
  subscribeCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});
export type ChannelQrCode = z.infer<typeof ChannelQrCodeSchema>;

/** 空响应 (data: null) */
export const VoidResponseSchema = z.null();
export type VoidResponse = z.infer<typeof VoidResponseSchema>;

// ── Input schema ─────────────────────────────────────────────────────────

/** GET /campaigns — 活动列表查询
 *  - page_size V1 默认 20,与 PageQuerySchema 默认一致,无需覆盖
 *  - type / status 枚举对齐 prisma.campaign
 */
export const ListCampaignsQuerySchema = PageQuerySchema.extend({
  type: z.enum(['h5_page', 'qrcode', 'referral']).optional(),
  status: z.enum(['draft', 'active', 'paused', 'ended']).optional(),
});
export type ListCampaignsQuery = z.infer<typeof ListCampaignsQuerySchema>;

/** POST /campaigns — 创建活动
 *  - 必填:name / type
 *  - 字段从 service.createCampaign.prisma.campaign.create({ data }) 推断
 *  - config JSONB,startAt / endAt 接受 ISO 字符串
 */
export const CreateCampaignInputSchema = z.object({
  name: z.string().min(1, '请填写活动名称'),
  type: z.enum(['h5_page', 'qrcode', 'referral']),
  description: z.string().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  startAt: z.string().optional(),
  endAt: z.string().optional(),
});
export type CreateCampaignInput = z.infer<typeof CreateCampaignInputSchema>;

/** PUT /campaigns/:id — 编辑活动 (partial) */
export const UpdateCampaignInputSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(['h5_page', 'qrcode', 'referral']).optional(),
  description: z.string().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  startAt: z.string().optional(),
  endAt: z.string().optional(),
});
export type UpdateCampaignInput = z.infer<typeof UpdateCampaignInputSchema>;

/** POST /campaigns/qrcodes — 创建渠道二维码
 *  - 必填:name / sceneStr
 *  - campaignId 可选,关联到指定活动
 */
export const CreateQrCodeInputSchema = z.object({
  name: z.string().min(1, '请填写渠道码名称'),
  sceneStr: z.string().min(1, '请填写场景值'),
  campaignId: z.string().optional(),
});
export type CreateQrCodeInput = z.infer<typeof CreateQrCodeInputSchema>;

// ── Output schema ────────────────────────────────────────────────────────

/** GET /campaigns — service.getCampaigns 分页 */
export const ListCampaignsOutputSchema = z.object({
  list: z.array(CampaignWithStatsSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  page_size: z.number().int().positive(),
});
export type ListCampaignsOutput = z.infer<typeof ListCampaignsOutputSchema>;

/** GET /campaigns/:id — service.getCampaign (含 stats) */
export const GetCampaignOutputSchema = CampaignWithStatsSchema;
export type GetCampaignOutput = z.infer<typeof GetCampaignOutputSchema>;

/** POST /campaigns — service.createCampaign */
export const CreateCampaignOutputSchema = CampaignBaseSchema;
export type CreateCampaignOutput = z.infer<typeof CreateCampaignOutputSchema>;

/** PUT /campaigns/:id — service.updateCampaign */
export const UpdateCampaignOutputSchema = CampaignBaseSchema;
export type UpdateCampaignOutput = z.infer<typeof UpdateCampaignOutputSchema>;

/** POST /campaigns/:id/:action — service.changeStatus */
export const ChangeStatusOutputSchema = CampaignBaseSchema;
export type ChangeStatusOutput = z.infer<typeof ChangeStatusOutputSchema>;

/** GET /campaigns/qrcodes/list — service.getQrCodes 数组 */
export const ListQrCodesOutputSchema = z.array(ChannelQrCodeSchema);
export type ListQrCodesOutput = z.infer<typeof ListQrCodesOutputSchema>;

/** POST /campaigns/qrcodes — service.createQrCode */
export const CreateQrCodeOutputSchema = ChannelQrCodeSchema;
export type CreateQrCodeOutput = z.infer<typeof CreateQrCodeOutputSchema>;

/** DELETE 共用 — service.deleteXxx 返回 { deleted: true } */
export const DeleteOutputSchema = z.object({
  deleted: z.literal(true),
});
export type DeleteOutput = z.infer<typeof DeleteOutputSchema>;
