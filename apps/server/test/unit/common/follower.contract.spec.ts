/**
 * follower.contract.ts — ListFollowersQuerySchema 默认值回归测试
 *
 * 背景: V1 FollowerListQueryDto.page_size 默认 50;PageQuerySchema 默认 20。
 *       之前 S2 Task 9 用 PageQuerySchema.extend 扩展 ListFollowersQuerySchema
 *       时未显式覆盖 page_size 默认值,导致 GET /followers 无参时返回 20 而非 50,
 *       对生产 V1 调用方构成 breaking change。
 *       本测试锁定 page_size 默认 = 50,防止再回归。
 */
import { ListFollowersQuerySchema } from '../../../src/common/contracts/follower.contract';

describe('ListFollowersQuerySchema 默认值 (V1 兼容)', () => {
  it('page_size 默认 50', () => {
    const result = ListFollowersQuerySchema.parse({});
    expect(result.page_size).toBe(50);
  });

  it('page 默认 1', () => {
    const result = ListFollowersQuerySchema.parse({});
    expect(result.page).toBe(1);
  });

  it('order 默认 desc', () => {
    const result = ListFollowersQuerySchema.parse({});
    expect(result.order).toBe('desc');
  });

  it('sort 默认 undefined (可选)', () => {
    const result = ListFollowersQuerySchema.parse({});
    expect(result.sort).toBeUndefined();
  });

  it('显式传入 page_size=10 仍生效,不被默认 50 覆盖', () => {
    const result = ListFollowersQuerySchema.parse({ page_size: 10 });
    expect(result.page_size).toBe(10);
  });
});
