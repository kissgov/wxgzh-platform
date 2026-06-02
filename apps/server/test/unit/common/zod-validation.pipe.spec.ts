/**
 * ZodValidationPipe — unit tests
 *
 * 覆盖:
 *  1. happy path: schema parse 成功,pipe 返回 parsed data
 *  2. failure: schema 校验失败 → 抛 BadRequestException,response body 含 code=10001 + errors[]
 */
import { ZodValidationPipe } from '../../../src/common/pipes/zod-validation.pipe';
import { z } from 'zod';
import { BadRequestException } from '@nestjs/common';

describe('ZodValidationPipe', () => {
  const schema = z.object({ name: z.string().min(1), age: z.number().int().min(0) });
  const pipe = new ZodValidationPipe(schema);

  it('returns parsed data on success', () => {
    expect(pipe.transform({ name: 'A', age: 1 }, { type: 'body' } as any)).toEqual({ name: 'A', age: 1 });
  });

  it('throws BadRequest with field errors', () => {
    try {
      pipe.transform({ name: '', age: -1 }, { type: 'body' } as any);
      fail('expected throw');
    } catch (e: any) {
      expect(e).toBeInstanceOf(BadRequestException);
      const body = e.getResponse();
      expect(body.code).toBe(10001);
      expect(body.errors.length).toBeGreaterThan(0);
    }
  });
});
