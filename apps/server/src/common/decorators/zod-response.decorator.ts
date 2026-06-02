/**
 * 出参 Zod schema 元数据装饰器 — 用于 OpenAPI 同步 (后续 Task) 与未来的出参校验。
 * 用法:  @ZodResponse(LoginOutputSchema)
 * 配合 NestJS Reflector 可在 interceptor/filter 中读取 schema 做强校验。
 */
import { SetMetadata } from '@nestjs/common';
import { ZodSchema } from 'zod';

export const ZOD_RESPONSE_KEY = 'zod:response';
export const ZodResponse = (schema: ZodSchema) => SetMetadata(ZOD_RESPONSE_KEY, schema);
