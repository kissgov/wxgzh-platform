// 消息管理相关 Zod Schemas
// ============================================================================
import { z } from 'zod';

/** 关键词回复 */
export const keywordReplySchema = z.object({
  matchType: z.enum(['exact', 'fuzzy', 'regex']),
  keyword: z.string().min(1, '关键词不能为空'),
});

/** 回复内容 */
export const replyContentSchema = z.object({
  contentType: z.enum(['text', 'image', 'voice', 'video', 'music', 'news', 'mpnews', 'miniprogram']),
  content: z.string().min(1),
  sortOrder: z.number().int().min(0).default(0),
});

/** 创建自动回复规则 */
export const createAutoReplySchema = z.object({
  ruleType: z.enum(['follow', 'keyword', 'default']),
  name: z.string().min(1).max(50),
  status: z.enum(['enabled', 'disabled']).default('enabled'),
  keywordReplies: z.array(keywordReplySchema).optional(),
  replyContents: z.array(replyContentSchema).min(1, '至少需要一条回复内容'),
});

/** 创建群发消息 */
export const createBroadcastSchema = z.object({
  msgType: z.enum(['text', 'image', 'mpnews', 'voice', 'video', 'wxcard']),
  content: z.record(z.unknown()),
  targetType: z.enum(['all', 'tag', 'region', 'gender']).default('all'),
  targetConfig: z.record(z.unknown()).optional(),
});

export type CreateAutoReplyInput = z.infer<typeof createAutoReplySchema>;
export type CreateBroadcastInput = z.infer<typeof createBroadcastSchema>;
