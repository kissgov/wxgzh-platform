/**
 * 消息管理模块 Zod 契约
 *
 * - InputSchema 严格对应 MessageController method 入参
 * - OutputSchema 对应 MessageService 实际返回结构 (service 是 source of truth)
 * - 覆盖消息日志 / 自动回复规则 / 关键词匹配 / 群发消息 / AI 智能回复
 *
 * 字段命名: camelCase (V1 风格)
 */
import { z } from 'zod';
import { PageQuerySchema } from './pagination.contract';

// ── 通用子 schema ────────────────────────────────────────────────────────

/** 粉丝简略信息 — messageLog.follower 关联 */
const MessageLogFollowerBriefSchema = z.object({
  id: z.string().min(1),
  nickname: z.string().nullable(),
  headImg: z.string().nullable(),
  openid: z.string().min(1),
});
export type MessageLogFollowerBrief = z.infer<typeof MessageLogFollowerBriefSchema>;

/** 关键词回复 — AutoReplyRule.keywordReplies 关联 */
const KeywordReplySchema = z.object({
  id: z.string().min(1),
  ruleId: z.string().min(1),
  matchType: z.string(), // exact | fuzzy | regex
  keyword: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type KeywordReply = z.infer<typeof KeywordReplySchema>;

/** 回复内容 — AutoReplyRule.replyContents 关联 */
const ReplyContentSchema = z.object({
  id: z.string().min(1),
  ruleId: z.string().min(1),
  contentType: z.string(), // text | image | voice | video | music | news | mpnews | miniprogram
  content: z.string(),
  sortOrder: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ReplyContent = z.infer<typeof ReplyContentSchema>;

/** 自动回复规则(含 keywordReplies / replyContents) — service.getAutoReplyRules / createAutoReplyRule / updateAutoReplyRule / matchKeywordReply */
const AutoReplyRuleWithRelationsSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  authorizerId: z.string().min(1),
  ruleType: z.string(), // follow | keyword | default
  name: z.string(),
  status: z.string(), // enabled | disabled
  priority: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
  keywordReplies: z.array(KeywordReplySchema),
  replyContents: z.array(ReplyContentSchema),
});
export type AutoReplyRuleWithRelations = z.infer<typeof AutoReplyRuleWithRelationsSchema>;

/** 自动回复规则(无 include,switch toggle 后的最小返回) — service.toggleAutoReplyRule */
const AutoReplyRuleBaseSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  authorizerId: z.string().min(1),
  ruleType: z.string(),
  name: z.string(),
  status: z.string(),
  priority: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});
export type AutoReplyRuleBase = z.infer<typeof AutoReplyRuleBaseSchema>;

/** 消息日志(含 follower 关联) — service.getMessageLogs.list 元素 */
const MessageLogSchema = z.object({
  id: z.string().min(1),
  authorizerId: z.string().min(1),
  followerId: z.string().min(1),
  msgId: z.string().nullable(),
  msgType: z.string(), // text | image | voice | video | location | link | event
  direction: z.string(), // inbound | outbound
  content: z.string().nullable(),
  mediaId: z.string().nullable(),
  event: z.string().nullable(),
  eventKey: z.string().nullable(),
  replyRuleId: z.string().nullable(),
  rawXml: z.string().nullable(),
  createdAt: z.string().datetime(),
  follower: MessageLogFollowerBriefSchema,
});
export type MessageLog = z.infer<typeof MessageLogSchema>;

/** 群发消息 — service.createBroadcast / sendBroadcast / getBroadcasts.list 元素 */
const BroadcastMessageSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  authorizerId: z.string().min(1),
  msgType: z.string(), // text | image | mpnews | voice | video | wxcard
  content: z.unknown(), // JSONB
  targetType: z.string(),
  targetConfig: z.unknown().nullable(),
  status: z.string(), // draft | pending | sending | success | partial | failed
  wechatMsgId: z.string().nullable(),
  wechatMsgDataId: z.string().nullable(),
  sentCount: z.number().int(),
  errorCount: z.number().int(),
  scheduledAt: z.string().datetime().nullable(),
  sentAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});
export type BroadcastMessage = z.infer<typeof BroadcastMessageSchema>;

/** 群发进度 — service.getBroadcastProgress (可能为 null) */
const BroadcastProgressSchema = z.object({
  id: z.string().min(1),
  status: z.string(),
  sentCount: z.number().int(),
  errorCount: z.number().int(),
});
export type BroadcastProgress = z.infer<typeof BroadcastProgressSchema>;

/** 空响应 (data: null) */
export const VoidResponseSchema = z.null();
export type VoidResponse = z.infer<typeof VoidResponseSchema>;

// ── Input schema ─────────────────────────────────────────────────────────

/** GET /messages/logs — 消息日志列表
 *  - page_size 覆盖默认 50 以兼容 V1 MessageLogQueryDto 行为
 *  - 保留 V1 方向过滤 / 类型过滤 / 关键词模糊搜索
 */
export const ListMessageLogsQuerySchema = PageQuerySchema.extend({
  page_size: PageQuerySchema.shape.page_size.default(50),
  direction: z.enum(['inbound', 'outbound']).optional(),
  msgType: z.string().optional(),
  keyword: z.string().optional(),
});
export type ListMessageLogsQuery = z.infer<typeof ListMessageLogsQuerySchema>;

/** POST /messages/auto-reply — 创建自动回复规则 */
const KeywordReplyInputSchema = z.object({
  matchType: z.enum(['exact', 'fuzzy', 'regex'], {
    errorMap: () => ({ message: 'matchType 必须是 exact / fuzzy / regex' }),
  }),
  keyword: z.string().min(1, '请填写关键词'),
});

const ReplyContentInputSchema = z.object({
  contentType: z.string().min(1, '请填写内容类型'),
  content: z.string().min(1, '请填写内容'),
  sortOrder: z.number().int().optional(),
});

export const CreateAutoReplyInputSchema = z.object({
  ruleType: z.enum(['follow', 'keyword', 'default'], {
    errorMap: () => ({ message: 'ruleType 必须是 follow / keyword / default' }),
  }),
  name: z.string().min(1, '请填写规则名称'),
  status: z.enum(['enabled', 'disabled']).optional().default('enabled'),
  keywordReplies: z.array(KeywordReplyInputSchema).optional(),
  replyContents: z.array(ReplyContentInputSchema).min(1, '至少需要 1 条回复内容'),
});
export type CreateAutoReplyInput = z.infer<typeof CreateAutoReplyInputSchema>;

/** PUT /messages/auto-reply/:ruleId — 编辑自动回复规则 (partial) */
export const UpdateAutoReplyInputSchema = CreateAutoReplyInputSchema.partial();
export type UpdateAutoReplyInput = z.infer<typeof UpdateAutoReplyInputSchema>;

/** POST /messages/broadcast — 创建群发消息 */
export const CreateBroadcastInputSchema = z.object({
  msgType: z.enum(['text', 'image', 'mpnews', 'voice', 'video', 'wxcard'], {
    errorMap: () => ({ message: 'msgType 必须是 text / image / mpnews / voice / video / wxcard' }),
  }),
  content: z.record(z.string(), z.unknown()),
  targetType: z.enum(['all', 'tag', 'region', 'gender']).optional().default('all'),
  targetConfig: z.record(z.string(), z.unknown()).optional(),
  scheduledAt: z.string().optional(),
});
export type CreateBroadcastInput = z.infer<typeof CreateBroadcastInputSchema>;

/** POST /messages/ai-reply — AI 智能回复入参 */
export const AiReplyInputSchema = z.object({
  keyword: z.string().min(1, '请填写关键词'),
});
export type AiReplyInput = z.infer<typeof AiReplyInputSchema>;

// ── Output schema ────────────────────────────────────────────────────────

/** GET /messages/logs — service.getMessageLogs 分页 */
export const ListMessageLogsOutputSchema = z.object({
  list: z.array(MessageLogSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  page_size: z.number().int().positive(),
});
export type ListMessageLogsOutput = z.infer<typeof ListMessageLogsOutputSchema>;

/** GET /messages/auto-reply — service.getAutoReplyRules 数组 */
export const ListAutoReplyRulesOutputSchema = z.array(AutoReplyRuleWithRelationsSchema);
export type ListAutoReplyRulesOutput = z.infer<typeof ListAutoReplyRulesOutputSchema>;

/** POST /messages/auto-reply — service.createAutoReplyRule */
export const CreateAutoReplyOutputSchema = AutoReplyRuleWithRelationsSchema;
export type CreateAutoReplyOutput = z.infer<typeof CreateAutoReplyOutputSchema>;

/** PUT /messages/auto-reply/:ruleId — service.updateAutoReplyRule */
export const UpdateAutoReplyOutputSchema = AutoReplyRuleWithRelationsSchema;
export type UpdateAutoReplyOutput = z.infer<typeof UpdateAutoReplyOutputSchema>;

/** DELETE /messages/auto-reply/:ruleId — V1 行为 data: null */
export const DeleteAutoReplyOutputSchema = VoidResponseSchema;
export type DeleteAutoReplyOutput = z.infer<typeof DeleteAutoReplyOutputSchema>;

/** PATCH /messages/auto-reply/:ruleId/toggle — service.toggleAutoReplyRule */
export const ToggleAutoReplyOutputSchema = AutoReplyRuleBaseSchema;
export type ToggleAutoReplyOutput = z.infer<typeof ToggleAutoReplyOutputSchema>;

/** GET /messages/broadcast — service.getBroadcasts 分页 */
export const ListBroadcastsOutputSchema = z.object({
  list: z.array(BroadcastMessageSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  page_size: z.number().int().positive(),
});
export type ListBroadcastsOutput = z.infer<typeof ListBroadcastsOutputSchema>;

/** POST /messages/broadcast — service.createBroadcast */
export const CreateBroadcastOutputSchema = BroadcastMessageSchema;
export type CreateBroadcastOutput = z.infer<typeof CreateBroadcastOutputSchema>;

/** POST /messages/broadcast/:id/send — V1 controller 硬编码 { status: 'pending' } */
export const SendBroadcastOutputSchema = z.object({
  status: z.literal('pending'),
});
export type SendBroadcastOutput = z.infer<typeof SendBroadcastOutputSchema>;

/** GET /messages/broadcast/:id/progress — service.getBroadcastProgress 可能为 null */
export const GetBroadcastProgressOutputSchema = BroadcastProgressSchema.nullable();
export type GetBroadcastProgressOutput = z.infer<typeof GetBroadcastProgressOutputSchema>;

/** POST /messages/ai-reply — 规则匹配或 AI 兜底 */
export const AiReplyOutputSchema = z.object({
  reply: z.string(),
  source: z.enum(['rule', 'ai']),
});
export type AiReplyOutput = z.infer<typeof AiReplyOutputSchema>;
