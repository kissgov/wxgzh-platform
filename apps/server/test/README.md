# 后端测试指南

## 跑测试

```bash
# 全部单测
cd apps/server
pnpm test

# 覆盖率
pnpm test:coverage

# 监听模式
pnpm test:watch

# CI 模式 (--ci --maxWorkers=2, 上传 coverage)
pnpm test:ci

# 跑特定测试
pnpm test auth.service
```

## 文件结构

```
apps/server/
├── jest.config.ts              # Jest 配置 (threshold 60%)
├── test/
│   ├── README.md               # 本文件
│   └── helpers/
│       ├── prisma-test.ts      # testcontainer PG + migrate + truncate
│       ├── factories.ts        # tenant/user/authorizer/follower/FollowerTag 工厂
│       ├── wechat-mock.ts      # nock 拦截 component_token / preauthcode / query_auth
│       ├── auth-helper.ts      # JwtService 实例化 + token 签发
│       └── index.spec.ts       # smoke test
└── src/modules/<module>/<name>.service.spec.ts   # 17 模块的单元测试
```

## 写新测试 (TDD 流程)

1. `src/modules/<module>/<name>.service.spec.ts` 创建
2. 引入 helper:
   ```ts
   import { setupTestDb, teardownTestDb, truncateAll, getPrisma } from '../../../test/helpers/prisma-test';
   import { Factories } from '../../../test/helpers/factories';
   ```
3. `beforeAll` → `setupTestDb()`
4. `afterAll` → `teardownTestDb()`
5. `beforeEach` → `truncateAll()`

## Mock 微信 API

```ts
import { WechatMock } from '../../../test/helpers/wechat-mock';
import nock from 'nock';

beforeEach(() => { nock.cleanAll(); });
it('test', () => {
  WechatMock.setupComponentToken();
  WechatMock.setupPreauthCode();
  // ... 跑业务 ...
});
```

## 当前覆盖

- 19 suites, 137 tests
- V1 17 个业务 service 全部有 spec 文件
- 覆盖率见 `pnpm test:coverage` 输出 (目标 60%, 当前 <20% 留 S1+)
- 报告路径: `apps/server/coverage/lcov-report/index.html`

## CI 集成

CI 在 `.github/workflows/ci.yml` 的 `test:` job 跑 `pnpm test:ci`, 自动上传 coverage 报告到 GitHub Actions artifact。
