/**
 * Zod 查询参数校验装饰器 — 替代 @Query()。
 * 用法:  @ZodQuery(ListFollowersQuerySchema) q: ListFollowersQuery
 * 注意: query 是 string, 用 z.coerce.number() / z.coerce.boolean() 自动转换。
 */
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ZodSchema } from 'zod';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';

export const ZodQuery = (schema: ZodSchema) =>
  createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    return new ZodValidationPipe(schema).transform(req.query, { type: 'query' });
  })();
