// test/e2e/helpers/factories.ts
// 简洁的工厂函数, 给 E2E 准备 tenant/user/authorizer/follower/tag 等
import * as bcrypt from 'bcryptjs';
import { getPrisma } from './prisma-test';

export const Factories = {
  async tenant(overrides: Partial<{ name: string; slug: string }> = {}) {
    return getPrisma().tenant.create({
      data: {
        name: overrides.name ?? 'Test Tenant',
        slug: overrides.slug ?? `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        contact: '测试',
        status: 'active',
        plan: 'free',
        billingPeriod: 'trial',
        maxAuthorizers: 5,
        maxUsers: 10,
        trialEndsAt: new Date(Date.now() + 14 * 86400000),
      },
    });
  },

  async user(
    tenantId: string,
    overrides: Partial<{ email: string; password: string; name: string; status: string }> = {},
  ) {
    return getPrisma().user.create({
      data: {
        tenantId,
        email: overrides.email ?? `u-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
        passwordHash: await bcrypt.hash(overrides.password ?? 'password123', 4),
        name: overrides.name ?? 'Test User',
        status: overrides.status ?? 'active',
      },
    });
  },

  async componentApp(
    overrides: Partial<{
      appId: string;
      appSecret: string;
      verifyTicket: string;
    }> = {},
  ) {
    return getPrisma().componentApp.create({
      data: {
        appId: overrides.appId ?? `comp-${Date.now()}`,
        appSecret: overrides.appSecret ?? 'sec_xxx',
        token: 'token_xxx',
        encodingAesKey: 'aek_xxx',
        verifyTicket: overrides.verifyTicket ?? 'enc_ticket',
      },
    });
  },

  async authorizer(
    tenantId: string,
    componentAppId: string,
    overrides: Partial<{ appId: string; status: string; nickName: string }> = {},
  ) {
    return getPrisma().authorizer.create({
      data: {
        tenantId,
        componentAppId,
        appId: overrides.appId ?? `wx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        appType: 2, // 服务号
        nickName: overrides.nickName ?? 'Test MP',
        refreshToken: 'mock_refresh_token',
        status: overrides.status ?? 'authorized',
        accessToken: 'mock_access',
        tokenExpireAt: new Date(Date.now() + 7200 * 1000),
        funcInfo: [],
      },
    });
  },

  async follower(
    tenantId: string,
    authorizerId: string,
    overrides: Partial<{ openid: string; subscribe: boolean }> = {},
  ) {
    return getPrisma().follower.create({
      data: {
        tenantId,
        authorizerId,
        openid: overrides.openid ?? `o-${Math.random().toString(36).slice(2, 10)}`,
        subscribe: overrides.subscribe ?? true,
      },
    });
  },

  async tag(
    tenantId: string,
    authorizerId: string,
    overrides: Partial<{ name: string }> = {},
  ) {
    return getPrisma().followerTag.create({
      data: {
        tenantId,
        authorizerId,
        name: overrides.name ?? `tag-${Date.now()}`,
      },
    });
  },
};
