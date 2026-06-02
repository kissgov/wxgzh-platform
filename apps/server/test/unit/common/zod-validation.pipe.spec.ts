/**
 * ZodValidationPipe — unit tests
 *
 * 覆盖:
 *  1. happy path: schema parse 成功,pipe 返回 parsed data
 *  2. failure: schema 校验失败 → 抛 BadRequestException,response body 含 code=BAD_REQUEST + errors[]
 *  3. 嵌套错误路径: i.path.join('.') 正确产出 'a.b'
 *  4. 非对象输入(null/undefined/数字/数组): 一律抛 BadRequest
 *  5. coerce + default 实际生效(不是仅"通过",而是返回 default 值)
 *  6. errors[].field + message 具体值匹配
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

  it('produces dotted field path for nested object errors', () => {
    const nestedSchema = z.object({ user: z.object({ name: z.string().min(1) }) });
    const nestedPipe = new ZodValidationPipe(nestedSchema);
    try {
      nestedPipe.transform({ user: { name: '' } }, { type: 'body' } as any);
      fail('expected throw');
    } catch (e: any) {
      expect(e).toBeInstanceOf(BadRequestException);
      const body = e.getResponse();
      expect(body.errors[0].field).toBe('user.name');
    }
  });

  it('throws BadRequest when input is null', () => {
    const objectPipe = new ZodValidationPipe(z.object({ x: z.string() }));
    expect(() => objectPipe.transform(null, { type: 'body' } as any)).toThrow(BadRequestException);
  });

  it('throws BadRequest when input is undefined', () => {
    const objectPipe = new ZodValidationPipe(z.object({ x: z.string() }));
    expect(() => objectPipe.transform(undefined, { type: 'body' } as any)).toThrow(BadRequestException);
  });

  it('throws BadRequest when input is a number', () => {
    const objectPipe = new ZodValidationPipe(z.object({ x: z.string() }));
    expect(() => objectPipe.transform(42, { type: 'body' } as any)).toThrow(BadRequestException);
  });

  it('throws BadRequest when input is an array', () => {
    const objectPipe = new ZodValidationPipe(z.object({ x: z.string() }));
    expect(() => objectPipe.transform([], { type: 'body' } as any)).toThrow(BadRequestException);
  });

  it('applies default and coerce — returns parsed data with defaults', () => {
    const pageSchema = z.object({ page: z.coerce.number().int().min(1).default(1) });
    const pagePipe = new ZodValidationPipe(pageSchema);
    const result = pagePipe.transform({}, { type: 'query' } as any);
    expect(result.page).toBe(1);
  });

  it('error field and message contain precise info for short string', () => {
    const strSchema = z.object({ name: z.string().min(2) });
    const strPipe = new ZodValidationPipe(strSchema);
    try {
      strPipe.transform({ name: '' }, { type: 'body' } as any);
      fail('expected throw');
    } catch (e: any) {
      expect(e).toBeInstanceOf(BadRequestException);
      const body = e.getResponse();
      expect(body.errors[0].field).toBe('name');
      expect(body.errors[0].message).toContain('at least 2');
    }
  });
});
