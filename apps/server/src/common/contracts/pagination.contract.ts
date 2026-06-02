/**
 * 通用分页查询参数 schema (page/page_size/sort/order)。
 * 使用 z.coerce.number 让 query string "1" 也能解析为 number。
 */
import { z } from 'zod';

export const PageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});
export type PageQuery = z.infer<typeof PageQuerySchema>;
