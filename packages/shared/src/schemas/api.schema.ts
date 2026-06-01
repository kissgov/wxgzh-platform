// API 通用 Zod Schemas — 运行时校验
// ============================================================================
import { z } from 'zod';

/** 分页参数 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
});

/** 排序参数 */
export const sortSchema = z.object({
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
});

/** 列表查询（分页+排序+关键词） */
export const listQuerySchema = paginationSchema.merge(sortSchema).extend({
  keyword: z.string().optional(),
});

/** 日期范围查询 */
export const dateRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  granularity: z.enum(['day', 'week', 'month']).optional().default('day'),
});

/** API 响应 Schema（用于前端校验后端返回数据） */
export const apiResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    code: z.number(),
    message: z.string(),
    data: dataSchema,
    trace_id: z.string(),
  });

/** 分页响应 Schema */
export const paginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    list: z.array(itemSchema),
    total: z.number().int(),
    page: z.number().int(),
    page_size: z.number().int(),
  });

export type ListQuery = z.infer<typeof listQuerySchema>;
export type DateRange = z.infer<typeof dateRangeSchema>;
