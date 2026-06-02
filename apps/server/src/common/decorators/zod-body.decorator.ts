/**
 * Zod 入参校验装饰器 — 替代 @Body()。
 * 用法:  @ZodBody(LoginInputSchema) input: LoginInput
 * 校验失败抛 BadRequestException,code=ErrorCodes.BAD_REQUEST, errors=[{field, message}]
 * 成功返回 parsed data(zod default/coerce/transform 全部生效)。
 */
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ZodSchema } from 'zod';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';

export const ZodBody = (schema: ZodSchema) =>
  createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    return new ZodValidationPipe(schema).transform(req.body, { type: 'body' });
  })();
