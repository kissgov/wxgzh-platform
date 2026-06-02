/**
 * HttpExceptionFilter — unit tests
 *
 * 覆盖:
 *  1. HttpException body 含 errors 字段(ZodValidationPipe 抛出的 field-level errors)
 *     → response body 顶层必须透出 errors 数组
 *  2. HttpException body 不含 errors(常规 NotFoundException)
 *     → response body 不包含 errors 键
 *  3. 非 HttpException(裸 Error)
 *     → 走 INTERNAL_ERROR 兜底,body 不含 errors
 */
import { ArgumentsHost, BadRequestException, NotFoundException } from '@nestjs/common';
import { HttpExceptionFilter } from '../../../src/common/filters/http-exception.filter';
import { ErrorCodes } from '@wxgzh/shared';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let mockResponse: any;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockResponse = {
      status: statusMock,
    };
    mockHost = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: {} }) as any,
        getResponse: () => mockResponse,
      }),
    } as unknown as ArgumentsHost;
  });

  it('exposes errors[] from HttpException body (Zod pipe compatibility)', () => {
    const fieldErrors = [
      { field: 'email', message: 'Invalid email' },
      { field: 'age', message: 'Must be positive' },
    ];
    const exception = new BadRequestException({
      code: ErrorCodes.BAD_REQUEST,
      message: '参数校验失败',
      errors: fieldErrors,
    });

    filter.catch(exception, mockHost);

    expect(statusMock).toHaveBeenCalledWith(400);
    const body = jsonMock.mock.calls[0]![0];
    expect(body.code).toBe(ErrorCodes.BAD_REQUEST);
    expect(body.message).toBe('参数校验失败');
    expect(body.data).toBeNull();
    expect(body.trace_id).toBeDefined();
    expect(body.errors).toEqual(fieldErrors);
  });

  it('omits errors key when HttpException body has no errors field', () => {
    const exception = new NotFoundException('资源不存在');

    filter.catch(exception, mockHost);

    expect(statusMock).toHaveBeenCalledWith(404);
    const body = jsonMock.mock.calls[0]![0];
    expect(body.code).toBe(ErrorCodes.NOT_FOUND);
    expect(body.message).toBe('资源不存在');
    expect(body.data).toBeNull();
    expect(body.trace_id).toBeDefined();
    expect(body).not.toHaveProperty('errors');
  });

  it('falls back to INTERNAL_ERROR without errors for non-HttpException', () => {
    const exception = new Error('unhandled boom');

    filter.catch(exception, mockHost);

    expect(statusMock).toHaveBeenCalledWith(500);
    const body = jsonMock.mock.calls[0]![0];
    expect(body.code).toBe(ErrorCodes.INTERNAL_ERROR);
    expect(body.data).toBeNull();
    expect(body.trace_id).toBeDefined();
    expect(body).not.toHaveProperty('errors');
  });
});
