/**
 * Zod NestJS PipeTransform
 *
 * 用法: @ZodBody(MySchema) / @ZodQuery(MySchema) 装饰器底层调用
 * 失败抛 BadRequestException,响应体 { code: ErrorCodes.BAD_REQUEST, message, errors: [{field,message}] }
 * 成功返回 parsed data(替代原始 input,因此 default/coerce 生效)。
 */
import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ZodSchema } from 'zod';
import { ErrorCodes, ErrorMessages } from '@wxgzh/shared';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown, _meta: ArgumentMetadata) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const errors = result.error.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      }));
      throw new BadRequestException({
        code: ErrorCodes.BAD_REQUEST,
        message: ErrorMessages[ErrorCodes.BAD_REQUEST],
        errors,
      });
    }
    return result.data;
  }
}
