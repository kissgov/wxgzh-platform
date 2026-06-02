// Fixture 工厂 — 创建测试数据
// ============================================================================
// 用法 (集成测试):
//   const tenant = await Factories.tenant();
//   const user = await Factories.user(tenant.id);
// 每次调用生成唯一字段 (slug / email / openid 等), 避免唯一约束冲突。
// ============================================================================
import * as bcrypt from 'bcryptjs';
import { getPrisma } from './prisma-test';

// 简单单调递增 + 时间戳, 保证同进程内唯一; 多进程并行可改 randomUUID。
let counter = 0;
const uniq = (prefix: string): string => `${prefix}_${Date.now()}_${++counter}`;

type ModelOverrides<T> = Partial<T> & Record<string, unknown>;

export const Factories = {
  /**
   * 创建一个租户。默认: name/slug 随机, status=active, plan=free。
   */
  async tenant(overrides: ModelOverrides<any> = {}) {
    return getPrisma().tenant.create({
      data: {
        name: uniq('Tenant'),
        slug: uniq('t'),
        status: 'active',
        plan: 'free',
        ...overrides,
      },
    });
  },

  /**
   * 创建一个用户。需要先有 tenantId。默认密码 hash 自 'password123' (cost 4 加速测试)。
   */
  async user(tenantId: string, overrides: ModelOverrides<any> = {}) {
    return getPrisma().user.create({
      data: {
        tenantId,
        email: `${uniq('u')}@test.local`,
        passwordHash: await bcrypt.hash('password123', 4),
        name: 'Test User',
        status: 'active',
        ...overrides,
      },
    });
  },

  /**
   * 创建一个第三方平台应用 (ComponentApp)。Authorizer 的前置依赖。
   */
  async componentApp(overrides: ModelOverrides<any> = {}) {
    return getPrisma().componentApp.create({
      data: {
        appId: uniq('wxcomp'),
        appSecret: 'mock_secret_enc',
        token: 'mock_token',
        encodingAesKey: 'mock_aes_key_enc',
        status: 'active',
        ...overrides,
      },
    });
  },

  /**
   * 创建一个授权公众号。若未传 componentAppId, 自动创建一个 componentApp。
   */
  async authorizer(tenantId: string, overrides: ModelOverrides<any> = {}) {
    const { componentAppId: overrideCompAppId, ...rest } = overrides;
    const componentAppId =
      (overrideCompAppId as string | undefined) ??
      (await this.componentApp()).id;
    return getPrisma().authorizer.create({
      data: {
        tenantId,
        componentAppId,
        appId: uniq('wx'),
        appType: 2,
        nickName: 'Test MP',
        funcInfo: [],
        status: 'authorized',
        ...rest,
      },
    });
  },

  /**
   * 创建一个粉丝。需要 tenantId + authorizerId。
   */
  async follower(
    tenantId: string,
    authorizerId: string,
    overrides: ModelOverrides<any> = {},
  ) {
    return getPrisma().follower.create({
      data: {
        tenantId,
        authorizerId,
        openid: uniq('oid'),
        nickname: '粉丝',
        subscribe: true,
        ...overrides,
      },
    });
  },

  /**
   * 创建一个粉丝标签 (FollowerTag)。需要 tenantId + authorizerId。
   * 注: V1 schema 使用 FollowerTag 而非 Tag (FollowerTag 含 authorizerId)。
   */
  async tag(
    tenantId: string,
    authorizerId: string,
    overrides: ModelOverrides<any> = {},
  ) {
    return getPrisma().followerTag.create({
      data: {
        tenantId,
        authorizerId,
        name: uniq('Tag'),
        color: '#1890ff',
        ...overrides,
      },
    });
  },
};
