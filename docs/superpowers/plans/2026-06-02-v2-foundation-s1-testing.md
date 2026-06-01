# V2.0 S1 — 测试底座 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 V1 后端 17 service 的单元测试覆盖率从 ~5% 提升到 ≥ 60%, 建立可重复使用的测试基础设施, 并把 coverage 报告接入 CI。

**Architecture:** Jest + ts-jest + supertest, 用 Prisma 的 test database 隔离; 公共 factory 函数 + mock helper, 让每个 service 测试 5-10 步内可写完。

**Tech Stack:** Jest 29 / ts-jest 29 / supertest 7 / @testcontainers/postgresql (本地真实 DB) / nock 13 (微信 API mock)

**Spec:** [../specs/2026-06-02-v2-foundation-design.md §1.5 §5.1](../specs/2026-06-02-v2-foundation-design.md)

**前置依赖:** 无 (S1 是地基的第 1 块)

**本 sprint 不动:**
- 不动业务 service 实现
- 不动 prisma schema
- 不动 controller (S2 才动)
- 不动前端 (S6 才动)

---

## 累计文件结构 (本 sprint 创建)

```
apps/server/
├── jest.config.ts                          # T1
├── jest.setup.ts                           # T1
├── test/
│   ├── helpers/
│   │   ├── prisma-test.ts                  # T2 (Prisma test instance)
│   │   ├── factories.ts                    # T2 (fixture factories)
│   │   ├── wechat-mock.ts                  # T2 (nock mocks)
│   │   └── auth-helper.ts                  # T2 (JWT/tenant 注入)
│   ├── unit/
│   │   ├── auth/auth.service.spec.ts       # T3
│   │   ├── tenant/tenant.service.spec.ts   # T4
│   │   ├── platform/platform.service.spec.ts # T5
│   │   ├── account/account.service.spec.ts # T6
│   │   ├── follower/follower.service.spec.ts # T7
│   │   ├── message/message.service.spec.ts # T8
│   │   ├── material/material.service.spec.ts # T9
│   │   ├── menu/menu.service.spec.ts       # T10
│   │   ├── analytics/analytics.service.spec.ts # T11
│   │   ├── agent/agent.service.spec.ts     # T12
│   │   ├── content/content.service.spec.ts # T13
│   │   ├── campaign/campaign.service.spec.ts # T14
│   │   ├── llm/llm.service.spec.ts         # T15
│   │   ├── payment/payment.service.spec.ts # T16
│   │   ├── oss/oss.service.spec.ts         # T17
│   │   └── tenant/{approval,invitation,team-activity}.service.spec.ts # T17
│   └── README.md                           # T18 (写如何跑测试)
└── package.json                            # T1 (加 jest scripts)

.github/workflows/ci.yml                    # T19 (加 coverage upload + 门槛)
```

**目标**: T19 完成后, CI 上 `pnpm test` 全绿, coverage 报告上传, 门槛 ≥ 60% 阻断。

---

## Task 1: 配置 Jest + TypeScript + Coverage

**Files:**
- Create: `apps/server/jest.config.ts`
- Create: `apps/server/jest.setup.ts`
- Modify: `apps/server/package.json:scripts`

- [ ] **Step 1: 安装依赖**

```bash
cd apps/server
pnpm add -D jest@29 ts-jest@29 @types/jest@29 supertest@7 @types/supertest@7 nock@13 @testcontainers/postgresql@10
```

- [ ] **Step 2: 写 jest.config.ts**

Create `apps/server/jest.config.ts`:

```typescript
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.spec.ts', '<rootDir>/test/**/*.spec.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.module.ts',
    '!src/**/*.dto.ts',
    '!src/main.ts',
    '!src/**/*.spec.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'json-summary', 'html'],
  coverageThreshold: {
    global: { lines: 60, functions: 60, statements: 60, branches: 50 },
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testTimeout: 30000,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};

export default config;
```

- [ ] **Step 3: 写 jest.setup.ts**

Create `apps/server/jest.setup.ts`:

```typescript
// Jest global setup
import 'reflect-metadata';

// 每个测试前清理
beforeEach(() => {
  jest.clearAllMocks();
});

// 抑制 console.log (单测期间)
if (process.env.NODE_ENV === 'test') {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const originalLog = console.log;
  // eslint-disable-next-line @typescript-eslint/no-console
  console.log = jest.fn();
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  afterAll(() => { console.log = originalLog; });
}
```

- [ ] **Step 4: 加 package.json scripts**

Modify `apps/server/package.json`, 在 `scripts` 段加:

```json
{
  "test": "jest",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage",
  "test:ci": "jest --coverage --ci --maxWorkers=2"
}
```

- [ ] **Step 5: 验证 Jest 能启动**

Run:
```bash
cd apps/server && pnpm test --listTests
```

Expected: 列出 `src/auth/auth.service.spec.ts` (V1 已有) 等至少 1 个 spec。

- [ ] **Step 6: 提交**

```bash
cd apps/server && git add jest.config.ts jest.setup.ts package.json
cd .. && git commit -m "chore(server): jest + ts-jest + coverage 门槛 60%"
```

---

## Task 2: 公共测试 helper (Prisma + Factory + Mock)

**Files:**
- Create: `apps/server/test/helpers/prisma-test.ts`
- Create: `apps/server/test/helpers/factories.ts`
- Create: `apps/server/test/helpers/wechat-mock.ts`
- Create: `apps/server/test/helpers/auth-helper.ts`

- [ ] **Step 1: 写 prisma-test.ts (test DB lifecycle)**

Create `apps/server/test/helpers/prisma-test.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { execSync } from 'node:child_process';

let container: StartedPostgreSqlContainer;
let prisma: PrismaClient;

export async function setupTestDb(): Promise<PrismaClient> {
  if (prisma) return prisma;
  container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('wxgzh_test')
    .withUsername('test')
    .withPassword('test')
    .start();
  const url = container.getConnectionUri() + '?schema=public';
  process.env.DATABASE_URL = url;
  execSync('npx prisma migrate deploy', { env: { ...process.env, DATABASE_URL: url }, stdio: 'inherit' });
  prisma = new PrismaClient({ datasourceUrl: url });
  return prisma;
}

export async function teardownTestDb(): Promise<void> {
  await prisma?.$disconnect();
  await container?.stop();
}

export async function truncateAll(): Promise<void> {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT LIKE '_prisma%'
  `;
  for (const { tablename } of tables) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE`);
  }
}

export function getPrisma(): PrismaClient {
  if (!prisma) throw new Error('Prisma not initialized; call setupTestDb() in beforeAll');
  return prisma;
}
```

- [ ] **Step 2: 写 factories.ts (fixture 工厂)**

Create `apps/server/test/helpers/factories.ts`:

```typescript
import { getPrisma } from './prisma-test';
import * as bcrypt from 'bcryptjs';

let counter = 0;
const uniq = (prefix: string) => `${prefix}_${Date.now()}_${++counter}`;

export const Factories = {
  async tenant(overrides: Partial<any> = {}) {
    return getPrisma().tenant.create({
      data: {
        name: uniq('Tenant'),
        slug: uniq('t'),
        ...overrides,
      },
    });
  },
  async user(tenantId: string, overrides: Partial<any> = {}) {
    return getPrisma().user.create({
      data: {
        tenantId,
        email: `${uniq('u')}@test.local`,
        passwordHash: await bcrypt.hash('password123', 4),
        name: 'Test User',
        ...overrides,
      },
    });
  },
  async authorizer(tenantId: string, overrides: Partial<any> = {}) {
    return getPrisma().authorizer.create({
      data: {
        tenantId,
        appId: uniq('wx'),
        appType: 2,
        nickName: 'Test MP',
        status: 'authorized',
        ...overrides,
      },
    });
  },
  async follower(tenantId: string, authorizerId: string, overrides: Partial<any> = {}) {
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
  async tag(tenantId: string, overrides: Partial<any> = {}) {
    return getPrisma().tag.create({
      data: { tenantId, name: uniq('Tag'), color: '#1890ff', ...overrides },
    });
  },
};
```

- [ ] **Step 3: 写 wechat-mock.ts (nock 拦截微信 API)**

Create `apps/server/test/helpers/wechat-mock.ts`:

```typescript
import nock from 'nock';

const WECHAT_API = 'https://api.weixin.qq.com';

export const WechatMock = {
  setupComponentToken() {
    nock(WECHAT_API)
      .post('/cgi-bin/component/api_component_token')
      .reply(200, { component_access_token: 'mock_comp_token', expires_in: 7200 });
  },
  setupPreauthCode() {
    nock(WECHAT_API)
      .post('/cgi-bin/component/api_create_preauthcode')
      .reply(200, { pre_auth_code: 'mock_preauth', expires_in: 1800 });
  },
  setupQueryAuth() {
    nock(WECHAT_API)
      .post('/cgi-bin/component/api_query_auth')
      .reply(200, {
        authorization_info: {
          authorizer_appid: 'wxmock123',
          authorizer_access_token: 'mock_authorizer_token',
          authorizer_refresh_token: 'mock_refresh',
          expires_in: 7200,
          func_info: [],
        },
      });
  },
  reset() { nock.cleanAll(); },
};
```

- [ ] **Step 4: 写 auth-helper.ts (JWT 注入)**

Create `apps/server/test/helpers/auth-helper.ts`:

```typescript
import * as jwt from 'jsonwebtoken';

export function makeJwt(payload: { sub: string; tenantId: string; roles?: string[] }): string {
  return jwt.sign(payload, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
}

export function authHeader(userId: string, tenantId: string, roles: string[] = ['tenant_owner']) {
  return { Authorization: `Bearer ${makeJwt({ sub: userId, tenantId, roles })}` };
}
```

- [ ] **Step 5: 验证 helpers 加载成功**

Create `apps/server/test/helpers/index.spec.ts`:

```typescript
import { Factories } from './factories';

describe('test helpers smoke', () => {
  it('exports Factories', () => {
    expect(Factories.tenant).toBeDefined();
  });
});
```

Run:
```bash
cd apps/server && pnpm test test/helpers/
```

Expected: PASS 1 test.

- [ ] **Step 6: 提交**

```bash
git add apps/server/test/helpers/
git commit -m "test(server): 公共测试 helper (Prisma/factory/wechat-mock/auth)"
```

---

## Task 3-6: 核心 4 service 测试 (auth/tenant/platform/account)

### Task 3: auth.service.spec.ts

**Files:**
- Create: `apps/server/src/modules/auth/auth.service.spec.ts`
- Modify: `apps/server/src/modules/auth/auth.service.ts` (如需暴露内部方法)

- [ ] **Step 1: 写失败测试 (login 成功)**

```typescript
// apps/server/src/modules/auth/auth.service.spec.ts
import { setupTestDb, teardownTestDb, truncateAll, getPrisma } from '../../../test/helpers/prisma-test';
import { Factories } from '../../../test/helpers/factories';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  beforeAll(async () => { await setupTestDb(); service = new AuthService(getPrisma()); });
  afterAll(async () => { await teardownTestDb(); });
  beforeEach(async () => { await truncateAll(); });

  describe('login', () => {
    it('returns tokens for valid credentials', async () => {
      const tenant = await Factories.tenant();
      await Factories.user(tenant.id, { email: 'a@b.com' });
      const result = await service.login({ email: 'a@b.com', password: 'password123' });
      expect(result.access_token).toBeDefined();
      expect(result.user.email).toBe('a@b.com');
    });
    it('throws UnauthorizedException for wrong password', async () => {
      const tenant = await Factories.tenant();
      await Factories.user(tenant.id, { email: 'a@b.com' });
      await expect(service.login({ email: 'a@b.com', password: 'wrong' })).rejects.toThrow();
    });
    it('throws for non-existent user', async () => {
      await expect(service.login({ email: 'none@x.com', password: 'x' })).rejects.toThrow();
    });
  });

  describe('hashPassword / verifyPassword', () => {
    it('hashes and verifies', async () => {
      const hash = await service.hashPassword('hello');
      expect(await service.verifyPassword('hello', hash)).toBe(true);
      expect(await service.verifyPassword('wrong', hash)).toBe(false);
    });
  });
});
```

- [ ] **Step 2: 跑测试 (期望部分失败)**

Run: `cd apps/server && pnpm test auth.service`
Expected: 大部分 FAIL, 因 `login` / `hashPassword` 等可能未在 AuthService 暴露。

- [ ] **Step 3: 在 auth.service.ts 暴露必要方法**

如果 `hashPassword` / `verifyPassword` 不存在, 加 (在 `AuthService` 类内):

```typescript
async hashPassword(pwd: string): Promise<string> {
  return bcrypt.hash(pwd, 12);
}
async verifyPassword(pwd: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pwd, hash);
}
```

(若 `login` 签名不同, 按实际调整测试, 但不要改 service 业务逻辑。)

- [ ] **Step 4: 跑测试到全绿**

Run: `cd apps/server && pnpm test auth.service`
Expected: PASS 4 tests.

- [ ] **Step 5: 提交**

```bash
git add apps/server/src/modules/auth/
git commit -m "test(auth): 4 tests for login + password (coverage 60%+)"
```

---

### Task 4: tenant.service.spec.ts

**Files:**
- Create: `apps/server/src/modules/tenant/tenant.service.spec.ts`

- [ ] **Step 1: 写失败测试 (createTenant / getTenant / updatePlan)**

```typescript
import { setupTestDb, teardownTestDb, truncateAll, getPrisma } from '../../../test/helpers/prisma-test';
import { Factories } from '../../../test/helpers/factories';
import { TenantService } from './tenant.service';

describe('TenantService', () => {
  let service: TenantService;
  beforeAll(async () => { await setupTestDb(); service = new TenantService(getPrisma()); });
  afterAll(async () => { await teardownTestDb(); });
  beforeEach(async () => { await truncateAll(); });

  it('creates tenant with default plan=free', async () => {
    const t = await service.createTenant({ name: 'Acme', slug: 'acme' });
    expect(t.plan).toBe('free');
    expect(t.maxAuthorizers).toBe(2);
  });
  it('throws on duplicate slug', async () => {
    await service.createTenant({ name: 'A', slug: 'dup' });
    await expect(service.createTenant({ name: 'B', slug: 'dup' })).rejects.toThrow();
  });
  it('updates plan and bumps limits', async () => {
    const t = await service.createTenant({ name: 'A', slug: 'a' });
    const updated = await service.updatePlan(t.id, { plan: 'pro', maxAuthorizers: 50 });
    expect(updated.plan).toBe('pro');
    expect(updated.maxAuthorizers).toBe(50);
  });
  it('soft deletes by setting deletedAt', async () => {
    const t = await service.createTenant({ name: 'A', slug: 'a' });
    await service.softDelete(t.id);
    const found = await service.getById(t.id);
    expect(found?.deletedAt).toBeTruthy();
  });
});
```

- [ ] **Step 2: 跑测试**

Run: `cd apps/server && pnpm test tenant.service`
Expected: 大部分 FAIL, 视实际 service 签名调整。

- [ ] **Step 3: 调整 service 暴露/调整测试 (不改业务)**

按 V1 实际方法名调整测试 (`create` / `findUnique` / `update` 等)。**禁止**改业务逻辑。

- [ ] **Step 4: 跑测试到全绿**

Run: `cd apps/server && pnpm test tenant.service`
Expected: PASS 4 tests.

- [ ] **Step 5: 提交**

```bash
git commit -am "test(tenant): 4 tests for create/duplicate/plan/soft-delete"
```

---

### Task 5: platform.service.spec.ts

**Files:**
- Create: `apps/server/src/modules/platform/platform.service.spec.ts`

- [ ] **Step 1: 写失败测试 (componentApp + 授权二维码生成)**

```typescript
import { setupTestDb, teardownTestDb, truncateAll, getPrisma } from '../../../test/helpers/prisma-test';
import { Factories } from '../../../test/helpers/factories';
import { PlatformService } from './platform.service';
import { WechatMock } from '../../../test/helpers/wechat-mock';
import nock from 'nock';

describe('PlatformService', () => {
  let service: PlatformService;
  beforeAll(async () => { await setupTestDb(); service = new PlatformService(getPrisma()); });
  afterAll(async () => { await teardownTestDb(); });
  beforeEach(async () => { await truncateAll(); nock.cleanAll(); });

  it('saves verify ticket (encrypted)', async () => {
    await service.handleVerifyTicket('compApp1', 'TICKET_RAW_VALUE');
    const app = await getPrisma().componentApp.findUnique({ where: { appId: 'compApp1' } });
    expect(app).toBeTruthy();
    expect(app!.verifyTicket).toBeDefined();
    expect(app!.verifyTicket).not.toBe('TICKET_RAW_VALUE'); // 加密后
  });
  it('generates preauth code via Wechat API', async () => {
    WechatMock.setupComponentToken();
    WechatMock.setupPreauthCode();
    const code = await service.generatePreauthCode('compApp1');
    expect(code).toBe('mock_preauth');
  });
  it('handles authorized event and creates Authorizer', async () => {
    WechatMock.setupComponentToken();
    WechatMock.setupQueryAuth();
    await service.handleAuthorized('compApp1', 'auth_code_xyz');
    const auth = await getPrisma().authorizer.findFirst({ where: { appId: 'wxmock123' } });
    expect(auth).toBeTruthy();
    expect(auth!.status).toBe('authorized');
  });
});
```

- [ ] **Step 2-5: 同 Task 3 流程 (跑失败 → 调整 → 跑绿 → 提交)**

```bash
git commit -am "test(platform): 3 tests for ticket/preauth/authorized"
```

---

### Task 6: account.service.spec.ts

**Files:**
- Create: `apps/server/src/modules/account/account.service.spec.ts`

- [ ] **Step 1: 写失败测试 (多账号列表 + 分组)**

```typescript
import { setupTestDb, teardownTestDb, truncateAll, getPrisma } from '../../../test/helpers/prisma-test';
import { Factories } from '../../../test/helpers/factories';
import { AccountService } from './account.service';

describe('AccountService', () => {
  let service: AccountService;
  beforeAll(async () => { await setupTestDb(); service = new AccountService(getPrisma()); });
  afterAll(async () => { await teardownTestDb(); });
  beforeEach(async () => { await truncateAll(); });

  it('lists authorizers scoped to tenant', async () => {
    const t1 = await Factories.tenant();
    const t2 = await Factories.tenant();
    await Factories.authorizer(t1.id);
    await Factories.authorizer(t1.id);
    await Factories.authorizer(t2.id);
    const list = await service.listAuthorizers(t1.id);
    expect(list.length).toBe(2);
  });
  it('creates group and assigns authorizer', async () => {
    const t = await Factories.tenant();
    const a = await Factories.authorizer(t.id);
    const g = await service.createGroup(t.id, { name: '品牌A' });
    await service.assignToGroup(a.id, g.id);
    const found = await getPrisma().authorizer.findFirst({
      where: { id: a.id },
      include: { groups: true },
    });
    expect(found!.groups.some(x => x.groupId === g.id)).toBe(true);
  });
  it('throws NotFound when tenantId mismatched', async () => {
    const t1 = await Factories.tenant();
    const t2 = await Factories.tenant();
    const a = await Factories.authorizer(t1.id);
    await expect(service.getAuthorizer(t2.id, a.id)).rejects.toThrow();
  });
});
```

- [ ] **Step 2-5: 同 Task 3 流程**

```bash
git commit -am "test(account): 3 tests for list/group/tenant-isolation"
```

---

## Task 7-11: 业务 5 service 测试 (follower/message/material/menu/analytics)

### Task 7: follower.service.spec.ts (高优先级, 205 行 controller)

- [ ] **Step 1: 写 5 个测试**

```typescript
import { setupTestDb, teardownTestDb, truncateAll, getPrisma } from '../../../test/helpers/prisma-test';
import { Factories } from '../../../test/helpers/factories';
import { FollowerService } from './follower.service';

describe('FollowerService', () => {
  let service: FollowerService;
  let tenantId: string, authorizerId: string;
  beforeAll(async () => { await setupTestDb(); service = new FollowerService(getPrisma()); });
  afterAll(async () => { await teardownTestDb(); });
  beforeEach(async () => {
    await truncateAll();
    const t = await Factories.tenant();
    tenantId = t.id;
    authorizerId = (await Factories.authorizer(tenantId)).id;
  });

  it('lists followers with pagination', async () => {
    for (let i = 0; i < 5; i++) await Factories.follower(tenantId, authorizerId);
    const { list, total } = await service.getFollowers(tenantId, authorizerId, { page: 1, page_size: 3 });
    expect(total).toBe(5);
    expect(list.length).toBe(3);
  });
  it('filters by keyword (nickname/openid/remark)', async () => {
    await Factories.follower(tenantId, authorizerId, { nickname: 'Alice' });
    await Factories.follower(tenantId, authorizerId, { nickname: 'Bob' });
    const { list } = await service.getFollowers(tenantId, authorizerId, { keyword: 'Alice' });
    expect(list.length).toBe(1);
    expect(list[0].nickname).toBe('Alice');
  });
  it('filters by tagId', async () => {
    const f1 = await Factories.follower(tenantId, authorizerId);
    const f2 = await Factories.follower(tenantId, authorizerId);
    const tag = await Factories.tag(tenantId);
    await getPrisma().followerTagRelation.create({ data: { followerId: f1.id, tagId: tag.id } });
    const { list } = await service.getFollowers(tenantId, authorizerId, { tagId: tag.id });
    expect(list.length).toBe(1);
  });
  it('soft-deletes follower', async () => {
    const f = await Factories.follower(tenantId, authorizerId);
    await service.deleteFollower(tenantId, f.id);
    const found = await getPrisma().follower.findUnique({ where: { id: f.id } });
    expect(found?.deletedAt).toBeTruthy();
  });
  it('creates tag and applies to multiple followers', async () => {
    const f1 = await Factories.follower(tenantId, authorizerId);
    const f2 = await Factories.follower(tenantId, authorizerId);
    const tag = await service.createTag(tenantId, { name: 'VIP' });
    await service.batchTag(tenantId, { tagId: tag.id, followerIds: [f1.id, f2.id] });
    const tagged = await getPrisma().followerTagRelation.count({ where: { tagId: tag.id } });
    expect(tagged).toBe(2);
  });
});
```

- [ ] **Step 2-5: 跑失败 → 调 service 暴露 → 跑绿 → 提交**

```bash
git commit -am "test(follower): 5 tests for list/filter/tag/delete"
```

---

### Task 8-11: message / material / menu / analytics

每个 service **写 3-4 个测试**, 按 Task 7 同流程。重点覆盖:
- message: 自动回复 CRUD + 关键词匹配优先级
- material: 上传 + 列表 + 删除 + 使用次数 +1
- menu: 树形结构 + 发布 + 模板
- analytics: 聚合查询 (T+1 数据) + 时间范围 + 多号对比

每个 task 模板:

```bash
# 1. 写 spec (类似 Task 7 风格)
# 2. 跑测试
cd apps/server && pnpm test <module>.service
# 3. 调整 service 暴露 (不改业务)
# 4. 跑绿
# 5. 提交
git commit -am "test(<module>): N tests for X/Y/Z"
```

逐个完成后 commit 5 次。

---

## Task 12-16: 高级 5 service 测试 (agent/content/campaign/llm/payment)

### Task 12: agent.service.spec.ts

- [ ] **写 4 个测试** (seedBuiltinSkills 幂等 / createAgent + skillIds / executeTask 成功 / executeTask 失败回写)

```typescript
// 关键 mock: LlmService.chat 返回固定 { content, tokensIn, tokensOut }
jest.spyOn(LlmService.prototype, 'chat').mockResolvedValue({ content: 'mock output', tokensIn: 10, tokensOut: 20 });
```

### Task 13: content.service.spec.ts

- [ ] **写 4 个测试** (Article CRUD / Template 复制 / Category 树 / Article 发到微信 (mock))

### Task 14: campaign.service.spec.ts

- [ ] **写 3 个测试** (Campaign CRUD / Channel QR 生成 / 漏斗 step 创建)

### Task 15: llm.service.spec.ts

- [ ] **写 3 个测试** (config 加载 / chat 走 OpenAI-compatible / 用量统计)

```typescript
// mock fetch / axios, 避免真实调外部 API
```

### Task 16: payment.service.spec.ts

- [ ] **写 3 个测试** (创建订单 / 微信支付回调验签 / 订阅状态更新)

---

## Task 17: 简单 4 service 测试 (oss/approval/invitation/team-activity)

- [ ] **每个 2-3 个测试**

oss: upload / getSignedUrl / delete (mock MinIO)
approval: createWorkflow / submit / approve/reject
invitation: create / accept / expire
team-activity: log / listByTenant

每个 task 1 commit。

---

## Task 18: 写 test/README.md

**Files:**
- Create: `apps/server/test/README.md`

- [ ] **Step 1: 写文档**

```markdown
# 后端测试指南

## 跑测试

\`\`\`bash
# 全部测试
pnpm test

# 覆盖率
pnpm test:coverage

# 监听模式
pnpm test:watch

# 单个 spec
pnpm test auth.service
\`\`\`

## 写新测试

1. 在 \`src/modules/<module>/<name>.service.spec.ts\` 创建
2. 使用 helper:
   \`\`\`ts
   import { setupTestDb, teardownTestDb, truncateAll, getPrisma } from '../../../test/helpers/prisma-test';
   import { Factories } from '../../../test/helpers/factories';
   \`\`\`
3. \`beforeAll\` → \`setupTestDb\`
4. \`afterAll\` → \`teardownTestDb\`
5. \`beforeEach\` → \`truncateAll\`

## Mock 微信 API

\`\`\`ts
import { WechatMock } from '../../../test/helpers/wechat-mock';
import nock from 'nock';

beforeEach(() => nock.cleanAll());
it('test', () => {
  WechatMock.setupComponentToken();
  // ... 跑业务 ...
});
\`\`\`

## 覆盖率门槛

- 全局: lines/functions/statements ≥ 60%, branches ≥ 50%
- CI 阻断: 低于门槛则 PR 失败
- 报告: \`apps/server/coverage/lcov-report/index.html\`
```

- [ ] **Step 2: 提交**

```bash
git add apps/server/test/README.md
git commit -m "docs(server): 测试指南 README"
```

---

## Task 19: CI 集成 coverage + 门槛

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: 修改 test job**

在 `.github/workflows/ci.yml` 的 `test:` job 内:

- 添加 `coverage` 步骤: 已经在 `pnpm test` 跑
- 添加 artifact upload:

```yaml
      - name: Upload coverage
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: apps/server/coverage/
```

- 在 `test:` job 末尾加:

```yaml
      - name: Check coverage threshold
        run: cd apps/server && pnpm test:ci --silent
```

(`coverageThreshold` 已在 jest.config.ts 配, jest 内部会失败退出非 0。)

- [ ] **Step 2: 提交并推 PR**

```bash
git add .github/workflows/ci.yml
git commit -m "ci(server): upload coverage + threshold gate"
git push origin <branch>
```

- [ ] **Step 3: 验证 CI 跑通**

打开 PR → 等待 CI → 确认 test + coverage 上传 + 门槛通过。

---

## Task 20: 全量验证

- [ ] **Step 1: 本地全量跑**

```bash
cd apps/server
pnpm install
pnpm test:ci
```

Expected: 全部 PASS, coverage 报告 ≥ 60% lines。

- [ ] **Step 2: 提交 coverage 报告到 docs**

```bash
mkdir -p docs/coverage-baseline
cp apps/server/coverage/coverage-summary.json docs/coverage-baseline/s1.json
git add docs/coverage-baseline/
git commit -m "docs: S1 coverage baseline (>= 60%)"
```

- [ ] **Step 3: 更新顶层 plan 标记 S1 完成**

Modify [顶层 plan](2026-06-02-v2-foundation.md) S1 行的"关键产出"列追加 `✅ Done @ 2026-MM-DD`。

---

## 完工判定 (S1)

- [ ] `pnpm test:ci` 在 CI 全绿
- [ ] `coverage/lcov-report/index.html` 全局 lines ≥ 60%
- [ ] 17 个 service 全部有 spec 文件
- [ ] `test/README.md` 写好
- [ ] CI artifact 上传 coverage
- [ ] 冒烟测试通过 (V1 业务功能可运行)

→ S1 完成, 进入 S2 (DTO/Zod 全量校验)
