// 粉丝管理相关 Zod Schemas
// ============================================================================
import { z } from 'zod';

/** 创建标签 */
export const createTagSchema = z.object({
  name: z.string().min(1, '标签名称不能为空').max(30, '标签名称最长 30 字'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, '颜色格式错误').optional(),
});

/** 标签规则条件 */
export const tagConditionSchema = z.object({
  field: z.enum(['interactCount', 'lastInteractAt', 'subscribeAt', 'province', 'sex']),
  operator: z.enum([
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
    'days_ago_gt', 'days_ago_gte', 'days_ago_lt', 'days_ago_lte',
    'contains', 'not_contains', 'starts_with', 'ends_with',
    'in', 'not_in',
  ]),
  value: z.union([z.number(), z.string(), z.array(z.string())]),
});

/** 创建标签规则 */
export const createTagRuleSchema = z.object({
  name: z.string().min(1).max(30),
  description: z.string().optional(),
  conditions: z.array(tagConditionSchema).min(1, '至少需要一条条件'),
  logic: z.enum(['AND', 'OR']).default('AND'),
  targetTagId: z.string().min(1),
});

/** 批量操作粉丝标签 */
export const batchTagSchema = z.object({
  followerIds: z.array(z.string()).min(1).max(1000),
  tagIds: z.array(z.string()).min(1),
});

export type CreateTagInput = z.infer<typeof createTagSchema>;
export type TagCondition = z.infer<typeof tagConditionSchema>;
export type CreateTagRuleInput = z.infer<typeof createTagRuleSchema>;
export type BatchTagInput = z.infer<typeof batchTagSchema>;
