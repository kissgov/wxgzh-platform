# V2.0 架构清理总结

> 日期: 2026-06-02
> Sprint: V2.0 S6 — 架构清理 + E2E 关键流

## 模块依赖

S6 落地循环依赖扫描 (`scripts/cycle-scan.sh`, madge 8 + CI 阻断)。当前结果: **0 循环依赖**。

依赖方向 (自上而下):

```
common/*  (无业务依赖)
   ↓
common/arch  (抽象基类)
   ↓
modules/*  (业务模块, 不互引)
   ↓
integrations/*  (微信/MinIO, 业务模块引)
```

## 抽象基类 (Task 2)

| 基类 | 路径 | 用途 |
|------|------|------|
| `AbstractService` | `apps/server/src/common/arch/abstract-service.ts` | 业务 service 基类, 统一 `safe()` 包装 + 日志 |
| `AbstractController` | `apps/server/src/common/arch/abstract-controller.ts` | 控制器基类 + `ProtectedController()` 装饰器 |

**V1 业务 service 暂不强制改造**, 留 V2.1。基类已就绪, 新业务 service 直接继承即可获得日志/计时能力。

### AbstractService 用法示例

```typescript
@Injectable()
export class MyService extends AbstractService {
  async doWork(input: Input) {
    return this.safe('doWork', async () => this.prisma.x.create({ data: input }), { userId: 'u1' });
  }
}
```

## 抽象接口 (Task 3 + 4)

### IStorageProvider

| 实现 | 触发条件 | 用途 |
|------|---------|------|
| `MinioStorageProvider` | `STORAGE_DRIVER=minio` | 生产: MinIO / S3 兼容 (用 V1 已有 minio SDK) |
| `LocalStorageProvider` | 默认 | 开发/测试: 本地 FS + HMAC token 签名 URL |

**用法**: 业务模块只依赖 `STORAGE_PROVIDER` Symbol, 不直接 import MinIO SDK。

```typescript
constructor(@Inject(STORAGE_PROVIDER) private storage: IStorageProvider) {}
```

5/5 单测覆盖 (put / exists / getSignedUrl / delete / stream)。

### IWechatClient

| 实现 | 状态 |
|------|------|
| `WechatClientImpl` | 已落地, 当前委托给 `WechatService` (V1) |

**后续 task**: 把 `wechat.service.ts` 的 API 调用部分拆分到 `WechatClientImpl`, 业务模块 (如 broadcast) 改用 `IWechatClient`。

## E2E 关键流 (Task 6/7/8)

| 流 | 文件 | 用例数 | 覆盖 |
|----|------|--------|------|
| 登录流 | `test/e2e/auth.e2e.spec.ts` | 6 | 未登录/错密码/正确/受保护/过期/DB 写入 |
| 微信授权流 | `test/e2e/wechat-auth.e2e.spec.ts` | 4 | ticket 加密/预授权码/authorized 事件/限频 |
| 群发流 | `test/e2e/broadcast.e2e.spec.ts` | 3 | 创建+发送/微信错/无权限 |

**合计 13 用例**。本地受限于无 Postgres/Redis, 在 GitHub Actions `e2e.yml` 跑通。

### E2E 基础设施

- `test/jest-e2e.json` — jest e2e 配置
- `test/e2e/helpers/e2e-app.ts` — NestJS app 启动 + mock storage
- `test/e2e/helpers/fixtures.ts` — supertest HTTP 助手 + JWT 工具
- `test/e2e/helpers/prisma-test.ts` — Prisma 客户端 + truncate 工具
- `test/e2e/helpers/factories.ts` — tenant/user/authorizer/follower/tag 工厂
- `test/e2e/helpers/wechat-mock.ts` — nock 微信 API 助手
- `test/e2e/helpers/setup-env.ts` — 全局 env 注入

## CI 集成 (Task 9)

- `e2e.yml` 触发 push/PR 到 main + 手动 dispatch
- 加 `pnpm --filter @wxgzh/shared build` step (server 运行时引用 shared dist)
- postgres + redis service containers
- 失败时上传 e2e-failure artifact

## 已知技术债

| 项 | 优先级 | 留给 |
|----|--------|------|
| V1 业务 service 改继承 AbstractService | P2 | V2.1 |
| WechatClientImpl 完全拆分 wechat.service.ts API 部分 | P2 | V2.1 |
| 微信上传媒体 multipart 走完整 S3 SDK | P3 | V2.1 |
| swagger-sync spec 落地 (S2 范围遗留) | P2 | S2 集成 |
| E2E `broadcast/preview` 用例 (V1 接口不存在) | P3 | V2.1 新接口 |
| E2E `refresh token 续签` 用例 (计划占位) | P3 | S6.1 补 |
| madge 报告 SVG 嵌入 README | P3 | 需环境装 graphviz |
| E2E 全量本地一键跑通 (缺 Windows psql/redis) | P3 | V2.1 docker-compose test target |

## 工具命令速查

```bash
# 循环依赖扫描
./scripts/cycle-scan.sh

# 依赖图 (CLI)
npx madge --extensions ts apps/server/src
npx madge --extensions ts --image depgraph.svg apps/server/src   # 需 graphviz

# 单测
cd apps/server && pnpm test

# E2E (需要 Postgres + Redis)
cd apps/server && pnpm test:e2e
```
