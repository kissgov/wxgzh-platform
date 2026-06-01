# V2.0 「地基先行」实施计划 — 顶层路线图

> **For agentic workers:** 每个 sprint 各自有独立 plan 文件 (见下表)。本顶层 plan 用于跨 sprint 的依赖、顺序、整体性决策。
> 本 plan **不是** step-level 计划 — 不直接执行。

**Goal:** 把 V1 业务堆栈转成"可演进 + 可观测 + 可回滚"的产品底座, 为 V2.1+ 业务方向打地基。

**Architecture:** 在 V1 模块化单体之上加一层"工程质量层" (Testing / Contract / Observability / Security / Delivery / Architecture), 不动业务功能。

**Tech Stack:** NestJS 10 / Prisma 6 / PostgreSQL 16 / Redis 7 / BullMQ / React + Vite + Ant Design / OpenTelemetry / Prometheus / Grafana / pino / Jest / supertest / Playwright / pnpm + Turborepo

---

## Sprint 拆分（6 sprint, 每个可独立发布）

| Sprint | 主题 | 详细 plan | 关键产出 | 依赖 |
|--------|------|----------|---------|------|
| S1 | 测试底座 | [s1-testing.md](2026-06-02-v2-foundation-s1-testing.md) | 17 service 补单测 ≥ 60%, Jest+CI+coverage | — |
| S2 | DTO/Zod 全量 | [s2-contracts.md](2026-06-02-v2-foundation-s2-contracts.md) | 17 controller 100% Zod, ESLint 强制, OpenAPI 同步 | S1 |
| S3 | 可观测性 | [s3-observability.md](2026-06-02-v2-foundation-s3-observability.md) | OTel + Prometheus + pino + Grafana 4 看板 + 告警 | S1, S2 |
| S4 | 安全加固 | [s4-security.md](2026-06-02-v2-foundation-s4-security.md) | RBAC + 越权扫描 + 限流 + 审计 + secret scan + 漏洞扫描 | S2, S3 |
| S5 | CI + 部署回滚 | [s5-delivery.md](2026-06-02-v2-foundation-s5-delivery.md) | Blue/Green + migration 双向 + rollback 演练 + CI 全套 | S1, S4 |
| S6 | 架构清理 + E2E | [s6-architecture-e2e.md](2026-06-02-v2-foundation-s6-architecture-e2e.md) | 抽象接口 + 循环依赖扫描 + 3 E2E 关键流 + MinIO 落地 | S1, S2 |

**累计文件结构**（本路线图下要创建/修改的文件总览）：

```
apps/server/src/common/
├── contracts/                     # S2
│   ├── index.ts
│   ├── auth.contract.ts
│   ├── tenant.contract.ts
│   └── ... (每模块一个)
├── observability/                 # S3
│   ├── otel.ts                    # OTel SDK 初始化
│   ├── metrics.ts                 # Prometheus exporter
│   ├── logger.ts                  # pino 工厂
│   └── interceptors/
├── ratelimit/                     # S4
│   ├── rate-limit.guard.ts
│   ├── rate-limit.module.ts
│   └── sliding-window.ts
├── security/                      # S4
│   ├── permissions.ts
│   ├── require-permission.decorator.ts
│   ├── audit.interceptor.ts
│   └── audit.service.ts
└── arch/                          # S6
    ├── abstract-service.ts
    └── cycle-detector.ts          # CLI for CI

apps/server/test/
├── unit/                          # S1 (17 模块)
│   ├── auth.service.spec.ts
│   └── ...
├── integration/                   # S1
└── e2e/                           # S6
    ├── auth.e2e.spec.ts
    ├── wechat-auth.e2e.spec.ts
    └── broadcast.e2e.spec.ts

infra/
├── grafana/                       # S3
│   ├── dashboards/
│   │   ├── http.json
│   │   ├── queues.json
│   │   ├── business.json
│   │   └── alerts.json
│   └── datasources.yml
└── prometheus/                    # S3
    ├── prometheus.yml
    └── alerts.yml

scripts/
├── deploy-blue.sh                 # S5
├── deploy-green.sh                # S5
├── rollback.sh                    # S5
└── cycle-scan.sh                  # S6

.github/workflows/
├── ci.yml                         # S5 (改造)
├── e2e.yml                        # S6 (新增)
└── security.yml                   # S4 (新增)

docs/
├── runbooks/                      # S3, S5
│   ├── deploy.md
│   ├── rollback.md
│   └── alerts.md
└── superpowers/
    ├── specs/
    │   └── 2026-06-02-v2-foundation-design.md
    └── plans/                     # ← 本目录
```

---

## 跨 Sprint 关键决策 (强制约束)

### 强制 1: TDD 优先
- 每个 task 必须先写失败测试 → 改最小代码 → 重构
- 详见各 sprint 计划内 "TDD 流程"

### 强制 2: 频率提交
- 每个 task 完成 5 步即 commit
- commit message 遵循 Conventional Commits (`feat:` / `fix:` / `chore:` / `test:` / `docs:` / `refactor:`)

### 强制 3: 不破坏 V1
- 每个 sprint 必须保证 V1 业务功能可运行
- 每周一次手动冒烟: 登录 + 公众号列表 + 群发一条空消息

### 强制 4: 公共基线 (S1 一次性立)
- `pnpm test` 在 CI 必须 < 5 min
- `pnpm lint` 必须 0 错
- `pnpm typecheck` 必须 0 错
- coverage 报告必须上传到 CI artifact

---

## V2.0 → V2.1 过渡判定 ("地基稳了")

- 全部 6 sprint 完成 + spec 第 1.5 节全部成功标准达成
- 连续 2 周生产无 P0/P1 事故
- 至少 1 次回滚演练成功
- Grafana 看板被团队日常使用 (有 dashboard URL 在 README)
- V2.1 候选决策: 团队决策是 AIGC 路径还是 CRM 路径

---

## 风险与缓解 (跨 sprint)

| 风险 | 触发 sprint | 缓解 |
|------|------------|------|
| 补 DTO 时发现 API 行为不一致 | S2 | 视为 bug 修复, 先标 deprecation 1 个版本 |
| OTel 引入增加延迟 | S3 | 采样率默认 10%, 可配置 |
| 蓝绿部署对宝塔不友好 | S5 | 准备 2 套 (蓝绿 + 简单 pm2 reload) 切换方案 |
| 团队 TDD 习惯没建立 | S1 | 配对编程 1 周 + code review 强制 review 测试 |
| MinIO 与生产部署位置冲突 | S6 | 复用 V1 文档路径, 检查 env 即可 |

---

## 变更记录

| 版本 | 日期 | 变更 | 作者 |
|------|------|------|------|
| v1.0 | 2026-06-02 | 初稿, 顶层路线图 + 6 sprint 入口 | Architecture |
