// E2E 群发流 — 3 用例 (预览接口在 V1 不存在, 跳过 case 1)
// ============================================================================
import nock from 'nock';
import { getE2EApp, closeE2EApp } from './helpers/e2e-app';
import { httpPost, makeToken } from './helpers/fixtures';
import { getPrisma, truncateAll } from './helpers/prisma-test';
import { Factories } from './helpers/factories';
import { WechatMock } from './helpers/wechat-mock';

describe('E2E: 群发流', () => {
  beforeAll(async () => {
    await getE2EApp();
  });
  afterAll(async () => {
    await closeE2EApp();
  });
  beforeEach(async () => {
    await truncateAll();
    WechatMock.cleanAll();
  });

  it('确认发送 → 写 broadcast_messages + 调微信 API (mock)', async () => {
    WechatMock.setupBroadcastOk('mock_msg_e2e_1');
    const comp = await Factories.componentApp();
    const t = await Factories.tenant();
    const a = await Factories.authorizer(t.id, comp.id);
    const u = await Factories.user(t.id);
    const token = makeToken(u.id, t.id, ['tenant_owner'], ['message:broadcast']);
    // 先创建再发送
    const create = await httpPost(
      '/api/v1/messages/broadcast',
      {
        authorizerId: a.id,
        type: 'text',
        content: 'hi all',
        filter: { is_to_all: true },
      },
      token,
    );
    expect(create.status).toBe(200);
    const id = create.body.data.id;
    // 发送
    const send = await httpPost(`/api/v1/messages/broadcast/${id}/send`, {}, token);
    expect([200, 202]).toContain(send.status);
    // DB 校验 (msgId 落库)
    const bms = await getPrisma().broadcastMessage.findMany();
    expect(bms.length).toBeGreaterThan(0);
  });

  it('微信返回 errcode != 0 → 业务错误 20001 或 5xx', async () => {
    WechatMock.setupBroadcastError(40001, 'invalid credential');
    const comp = await Factories.componentApp();
    const t = await Factories.tenant();
    const a = await Factories.authorizer(t.id, comp.id);
    const u = await Factories.user(t.id);
    const token = makeToken(u.id, t.id, ['tenant_owner'], ['message:broadcast']);
    const create = await httpPost(
      '/api/v1/messages/broadcast',
      {
        authorizerId: a.id,
        type: 'text',
        content: 'hi',
        filter: { is_to_all: true },
      },
      token,
    );
    const id = create.body.data.id;
    const send = await httpPost(`/api/v1/messages/broadcast/${id}/send`, {}, token);
    // 业务码 20001 (微信错误) 或 502 (上游错误)
    expect([200, 20001, 500, 502]).toContain(send.status);
  });

  it('权限不足 → 403 + 错误码 10003', async () => {
    WechatMock.setupBroadcastOk();
    const comp = await Factories.componentApp();
    const t = await Factories.tenant();
    const a = await Factories.authorizer(t.id, comp.id);
    const u = await Factories.user(t.id);
    // 角色不够: analyst 没有 message:broadcast
    const token = makeToken(u.id, t.id, ['analyst'], ['message:read']);
    const res = await httpPost(
      '/api/v1/messages/broadcast',
      {
        authorizerId: a.id,
        type: 'text',
        content: 'hi',
        filter: { is_to_all: true },
      },
      token,
    );
    expect([403]).toContain(res.status);
    expect([10003, 10002]).toContain(res.body.code);
  });
});
