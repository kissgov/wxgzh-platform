// Smoke test — 验证 helpers 模块可以加载 / 类型正确
// ============================================================================
// 不启动 testcontainer (那是集成测试 Task 7+ 的事)。本测试仅验证 import
// 不抛错, 函数签名存在, getPrisma() 在未初始化时正确抛错。
// ============================================================================
import { Factories } from './factories';
import { WechatMock } from './wechat-mock';
import { makeJwt, authHeader } from './auth-helper';
import { getPrisma, setupTestDb, teardownTestDb, truncateAll } from './prisma-test';

describe('test/helpers smoke', () => {
  it('exports Factories with all expected factory methods', () => {
    expect(typeof Factories.tenant).toBe('function');
    expect(typeof Factories.user).toBe('function');
    expect(typeof Factories.componentApp).toBe('function');
    expect(typeof Factories.authorizer).toBe('function');
    expect(typeof Factories.follower).toBe('function');
    expect(typeof Factories.tag).toBe('function');
  });

  it('exports WechatMock with all expected mock methods', () => {
    expect(typeof WechatMock.setupComponentToken).toBe('function');
    expect(typeof WechatMock.setupPreauthCode).toBe('function');
    expect(typeof WechatMock.setupQueryAuth).toBe('function');
    expect(typeof WechatMock.reset).toBe('function');
    expect(typeof WechatMock.assertAllConsumed).toBe('function');
  });

  it('exports prisma-test lifecycle functions', () => {
    expect(typeof setupTestDb).toBe('function');
    expect(typeof teardownTestDb).toBe('function');
    expect(typeof truncateAll).toBe('function');
    expect(typeof getPrisma).toBe('function');
  });

  it('getPrisma() throws when called before setupTestDb()', () => {
    expect(() => getPrisma()).toThrow(/Prisma not initialized/);
  });

  it('makeJwt() signs a token containing the payload', () => {
    const token = makeJwt({ sub: 'u1', tenantId: 't1', roles: ['admin'] });
    expect(typeof token).toBe('string');
    // JWT format: header.payload.signature
    const parts = token.split('.');
    expect(parts).toHaveLength(3);
    const decoded = JSON.parse(
      Buffer.from(parts[1] as string, 'base64url').toString('utf8'),
    );
    expect(decoded.sub).toBe('u1');
    expect(decoded.tenantId).toBe('t1');
    expect(decoded.roles).toEqual(['admin']);
  });

  it('authHeader() returns a Bearer header object', () => {
    const h = authHeader('u1', 't1');
    expect(h).toHaveProperty('Authorization');
    expect(h.Authorization).toMatch(/^Bearer /);
  });
});
