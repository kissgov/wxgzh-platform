/**
 * 通用 API 响应 schema
 *
 * - ApiResponseSchema<T>(dataSchema): { code, message, data?, trace_id? }
 * - PaginatedSchema<T>(itemSchema): { list, total, page, page_size }
 * - ErrorSchema: { code, message, errors?, trace_id? }
 *
 * 用于 controller 出参 + Swagger 同步。
 */
import { z } from 'zod';

export const ApiResponseSchema = <T extends z.ZodTypeAny>(data: T) =>
  z.object({
    code: z.number().int(),
    message: z.string(),
    data: data.optional(),
    trace_id: z.string().uuid().optional(),
  });

export const PaginatedSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    list: z.array(item),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    page_size: z.number().int().positive(),
  });

export const ErrorSchema = z.object({
  code: z.number().int(),
  message: z.string(),
  errors: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
  trace_id: z.string().uuid().optional(),
});
