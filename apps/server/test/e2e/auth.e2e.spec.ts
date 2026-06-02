// E2E 登录流 — 5 用例
// ============================================================================
import { getE2EApp, closeE2EApp } from './helpers/e2e-app';
import { httpGet, httpPost, makeToken } from './helpers/fixtures';
import { getPrisma, truncateAll } from './helpers/prisma-test';
import { Factories } from './helpers/factories';
import * as jwt from 'jsonwebtoken';

describe('E2E: 登录流', () => {
  beforeAll(async () => {
    await getE2EApp();
  });
  afterAll(async () => {
    await closeE2EApp();
  });
  beforeEach(async () => {
    await truncateAll();
  });

  it('未登录访问受保护接口 → 401', async () => {
    const res = await httpGet('/api/v1/accounts');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(10002);
  });

  it('错误密码 → 401 + 错误码 10002', async () => {
    const t = await Factories.tenant();
    await Factories.user(t.id, { email: 'a@b.com', password: 'password123' });
    const res = await httpPost('/api/v1/auth/login', { email: 'a@b.com', password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(10002);
  });

  it('正确凭据 → 200 + access_token + user 信息', async () => {
    const t = await Factories.tenant();
    await Factories.user(t.id, { email: 'a@b.com', password: 'password123' });
    const res = await httpPost('/api/v1/auth/login', { email: 'a@b.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data.access_token).toBeDefined();
    expect(res.body.data.refresh_token).toBeDefined();
    expect(res.body.data.user.email).toBe('a@b.com');
  });

  it('携带有效 token 访问受保护接口 → 200', async () => {
    const t = await Factories.tenant();
    const u = await Factories.user(t.id, { email: 'a@b.com' });
    const token = makeToken(u.id, t.id, ['tenant_owner'], ['account:read']);
    const res = await httpGet('/api/v1/accounts', token);
    expect([200, 204]).toContain(res.status);
  });

  it('token 过期 → 401 + 错误码 10002', async () => {
    const expired = jwt.sign(
      { sub: 'u1', tenantId: 't1', roles: ['tenant_owner'], permissions: [] },
      process.env['JWT_SECRET'] || 'test-secret',
      { expiresIn: '-1s' },
    );
    const res = await httpGet('/api/v1/accounts', expired);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(10002);
  });

  it('DB 写入校验: 登录后 lastLoginAt 被更新', async () => {
    const t = await Factories.tenant();
    const u = await Factories.user(t.id, { email: 'a@b.com', password: 'password123' });
    const res = await httpPost('/api/v1/auth/login', { email: 'a@b.com', password: 'password123' });
    expect(res.status).toBe(200);
    const after = await getPrisma().user.findUnique({ where: { id: u.id } });
    expect(after?.lastLoginAt).toBeTruthy();
  });
});
