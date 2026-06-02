// 统一异常过滤器 — 将所有异常格式化为 ApiResponse
// ============================================================================
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { ErrorCodes, ErrorMessages } from '@wxgzh/shared';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: number = ErrorCodes.INTERNAL_ERROR;
    let message: string = ErrorMessages[ErrorCodes.INTERNAL_ERROR]!;
    let fieldErrors: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'object' && res !== null) {
        const r = res as Record<string, unknown>;
        message = (r['message'] as string) || exception.message;
        code = (r['code'] as number) || status;
        // 透出 field-level errors(Zod / class-validator),仅当非 undefined
        if (r['errors'] !== undefined) {
          fieldErrors = r['errors'];
        }
      } else {
        message = exception.message;
      }

      // 映射 HTTP 状态码到业务错误码
      if (status === 400) code = ErrorCodes.BAD_REQUEST;
      if (status === 401) code = ErrorCodes.UNAUTHORIZED;
      if (status === 403) code = ErrorCodes.FORBIDDEN;
      if (status === 404) code = ErrorCodes.NOT_FOUND;
      if (status === 429) code = ErrorCodes.RATE_LIMITED;
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled error: ${exception.message}`, exception.stack);
    }

    const traceId =
      (request.headers['x-trace-id'] as string) || uuid();

    const responseBody: Record<string, unknown> = {
      code,
      message: Array.isArray(message) ? message.join('; ') : message,
      data: null,
      trace_id: traceId,
    };
    if (fieldErrors !== undefined) {
      responseBody['errors'] = fieldErrors;
    }

    response.status(status).json(responseBody);
  }
}
