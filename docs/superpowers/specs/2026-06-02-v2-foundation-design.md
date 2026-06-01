# V2.0 「地基先行」— 设计文档

> 日期: 2026-06-02 | 版本: v2.0.0-design | 状态: 待用户批准
> 项目: 微信公众号第三方运营管理平台 | 起点: V1.0.0 (4 次提交, 已部署生产)

---

## 0. 摘要 (TL;DR)

将 V1 的"功能堆"转为"可演进 + 可观测 + 可回滚"的产品底座。V2.0 不动业务功能,
聚焦**测试 / DTO / 可观测性 / 安全 / CI / 部署回滚 / 架构清理**七个工程维度。
V2.1+ 再叠加 AIGC / CRM / 多渠道等业务方向。

**实测驱动的决策依据** (V1 现状, 2026-06-02 grep):

| 维度 | 实测 | 判定 |
|------|------|------|
| 业务模块 | 17 controller / 50+ service / 1405 行 schema | 覆盖足够 |
| 单元测试 | `apps/server/src` 全量 grep → **仅 1 个 spec.ts** | 必须补 |
| DTO 校验 | 8 个 DTO 文件 / 17 controller | 多数 `body: any` |
| 前端测试 | 无 | 暂缓(本 spec 范围) |
| 可观测性 | 无 OTel / 无 metrics / 无告警 | 必须补 |
| MinIO/S3 | 文档有, 代码无 S3/MinioClient 引用 | 需补实现 |
| CI 流水线 | lint + typecheck + test + build 配齐 | 配置齐, 内容缺 |
| BullMQ | token-refresh / sync-data / tag-rule 真接入 | OK |
| 微信加密 | AES-256-CBC 已实现 | OK |

---

## 1. 目标与边界

### 1.1 顶层目标

把 V1 的"功能堆"转成"**可演进 + 可观测 + 可回滚**"的产品底座,
使 V2.1+ 推 AIGC/CRM/多渠道时有安全网与扩展点。

### 1.2 V2 = 三层结构

```
V2 路线图 (顶层)
├── V2.0 「地基」       ← 本 spec 详写
│   范围: 测试 / DTO / 可观测性 / 安全 / CI / 部署回滚 / 架构清理
│   不动业务功能
│
├── V2.1 「差异化」     ← 后续 spec (不在本 spec 范围)
│   候选: AIGC 内容/智能客服  或  CRM/营销转化
│   选择条件: V2.0 完工 + 连续 2 周生产无 P0/P1
│
└── V2.2 「生态」       ← 后续 spec (不在本 spec 范围)
    候选: 视频号 / 小程序 / 企业微信 多渠道打通
```

### 1.3 V2.0 范围 (IN)

1. **测试底座** — 单元 60% 覆盖 + 集成 + E2E 关键流
2. **DTO/Zod 全量校验** — 入参 + 出参
3. **可观测性** — OTel trace + Prometheus metrics + pino 结构化日志 + 告警规则
4. **安全加固** — RBAC + 租户越权扫描 + 限流 + 审计日志强制
5. **CI 升级** — coverage 门槛 + e2e job + secret scan + 漏洞扫描
6. **部署/回滚** — 蓝绿/灰度 + migration 双向 + rollback 脚本
7. **架构清理** — 模块边界接口 + 事件命名规范 + 循环依赖扫描 + MinIO 落地补全

### 1.4 V2.0 明确 OUT (避免 scope creep)

- 不加新业务功能
- 不动业务功能 UI 文案
- 不动 prisma schema (除非审计/可观测性需要的最小字段)
- 不重写前端框架
- 不换数据库/队列
- 不做压测专项 sprint (随 S3/S4 自然进行)

### 1.5 成功标准 (V2.0 完工判定)

- 单元测试覆盖率 ≥ 60% (按行) / 集成 ≥ 50% / 关键流 E2E 100%
- DTO 覆盖率 = 100% controller
- Grafana 看板 4 块 (请求 / 队列 / 业务 / 告警) 在线
- 1 次蓝绿发布成功 + 1 次回滚演练成功
- CI 全绿, 含 security scan, 0 漏洞阻断
- 模块依赖图无循环
- `pnpm test` 在 CI < 5 min
- MinIO 端到端 (上传 → 用 media_id) 跑通

---

## 2. 架构与组件

### 2.1 V2.0 架构原则

V1 业务层**不动**, 只补"工程质量层":

```
┌─────────────────────────────────────────────────────────────┐
│ V1 业务层 (不动)                                            │
│ 17 modules: auth/tenant/platform/account/follower/         │
│  message/material/menu/analytics + agent/content/          │
│  campaign/llm/payment/oss/team                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│ V2.0 工程质量层 (新增)                                       │
│ ├── TestingLayer        单测 + 集成 + E2E                   │
│ ├── ContractLayer       Zod 入参/出参 + OpenAPI 同步         │
│ ├── ObservabilityLayer  OTel + Prometheus + pino + Alert    │
│ ├── SecurityLayer       RBAC + TenantGuard + RateLimit      │
│ ├── DeliveryLayer       CI 升级 + 蓝绿 + Migration 双向      │
│ └── ArchitectureLayer   Module 抽象接口 + 循环依赖扫描        │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 新增/改造模块清单

| 名称 | 位置 | 作用 |
|------|------|------|
| `common/contracts/*` | `apps/server/src/common/contracts/` | Zod schema 集中仓, 所有 DTO 共用 |
| `common/observability/*` | `apps/server/src/common/observability/` | OTel SDK 初始化 / Prometheus exporter / pino 工厂 |
| `common/ratelimit/*` | `apps/server/src/common/ratelimit/` | Redis 滑动窗口限流器 (per-tenant/per-IP/per-route) |
| `common/security/*` | `apps/server/src/common/security/` | `@RequirePermission` / 审计中间件 |
| `common/arch/*` | `apps/server/src/common/arch/` | 抽象接口基类 / 循环依赖检测器 (CI 用) |
| `apps/server/test/e2e/` | 新增 | Playwright + supertest 关键流 |
| `infra/grafana/` | 新增 | 4 块 dashboard JSON |
| `infra/prometheus/` | 新增 | scrape 配置 + alert rules YAML |
| `.github/workflows/ci.yml` | 改造 | 加 coverage/e2e/security job |

### 2.3 强制规则 (用 ESLint + CI 落地)

- 任何 controller 方法必须用 Zod schema 声明入参 (`@ZodBody(FooSchema)`)
- 任何 service 方法返回类型禁止 `any` / `unknown` (除非显式 type guard)
- 任何外部副作用 (写库 / 调 API) 必须有 logger
- 任何 `Promise.all` 需配合超时/兜底
- 任何 controller 方法必须声明 `@RequirePermission(...)` (除非 `@Public`)

### 2.4 保留不变

- NestJS + Prisma + PostgreSQL + Redis + BullMQ 技术栈
- 模块化单体 (**不**上微服务)
- 多租户共享 DB + tenantId 隔离
- Zod 双向校验思路 (**只补覆盖率**)
- 微信 API 集成层 (wechat.module.ts)

---

## 3. 数据流与关键流

### 3.1 请求级 (每个 HTTP API 自动获得)

```
[React]
   │  Authorization: Bearer <jwt>
   │  X-Request-Id: <uuid>          ← 前端生成
   ▼
[Nginx] ── TLS offload ──▶ [NestJS]
   │
   ├─ 1. TraceIdInterceptor   ← 注入 trace_id (W3C traceparent)
   ├─ 2. RateLimitGuard       ← Redis 滑动窗口: tenant 100/s, IP 50/s
   ├─ 3. JwtAuthGuard         ← 验签 + 提取 tenantId/roles
   ├─ 4. RequirePermission    ← RBAC 校验 (装饰器声明)
   ├─ 5. ZodValidationPipe    ← body/query/params 入参校验
   ├─ 6. AuditLogInterceptor  ← 写 audit_logs (敏感操作)
   ├─ 7. Controller           ← 业务逻辑
   ├─ 8. PrismaService        ← tenantId 自动注入 (V1 已有)
   └─ 9. ResponseInterceptor  ← 出参 Zod 校验 + 统一格式
   │
   ▼
[OTel Span] ──▶ [Prometheus metrics] ──▶ [pino 结构化日志]
   │                                              │
   └────────────────── trace_id 关联 ──────────────┘
```

### 3.2 队列任务级 (BullMQ 同理)

```
[Scheduler] ──▶ [Queue] ──▶ [Worker]
                              │
                              ├─ TraceId 注入 (来自入参/header)
                              ├─ pino logger
                              ├─ Prometheus 任务 metrics
                              └─ 失败重试 → DLQ → 告警
```

### 3.3 E2E 关键流 (V2.0 必须全绿)

1. **登录流** — `POST /auth/login` → JWT 签发 → 访问受保护接口 → 续签 → 登出
2. **授权流** — 第三方平台扫码 → ticket 接收 → component_token 刷新 → 公众号基本信息同步
3. **群发流** — 选标签 → 预览 → 群发 → 进度轮询 → 失败重试 (mock 微信 API)
4. (可选) **支付流** — 订阅下单 → 微信支付回调 → 订单状态更新

### 3.4 部署回滚流 (蓝绿)

```
[Build] → [Image: v2.0.0] ─┬─→ [Blue  (当前生产)]   ← 100% 流量
                            └─→ [Green (新版本)]     ← 0% 流量
                                                    ↓ 健康检查通过
                                            [Switch traffic 100% → Green]
                                                    ↓ 出问题
                                            [Rollback 100% → Blue]   ← 1 分钟内
```

- 触发回滚的自动化: Prometheus alert → webhook → 切流量
- 数据库 migration 双向: 每个 migration 必须有 down 方法, CI 校验

---

## 4. 错误处理与安全

### 4.1 错误处理 (统一四层)

| 层 | 触发 | 行为 |
|----|------|------|
| **L1 校验** | Zod 失败 | 抛 `ZodValidationException` → 400 + 字段级 errors |
| **L2 业务** | `throw new BusinessException(code, msg)` | 由过滤器映射为 4xx/5xx + 业务错误码 |
| **L3 系统** | 微信 API 失败 / DB 失败 / Redis 失败 | 自动重试 N 次 + 告警 + 友好提示 |
| **L4 未捕获** | 任何未处理 throw | 全局 `AllExceptionsFilter` → 500 + trace_id, **绝不**泄露堆栈到客户端 |

- 所有错误响应携带 `trace_id`, 前端可显示并支持一键上报
- 错误码维持 V1 的 `0 / 10001-10006 / 20001-20003 / 30001-30002`
- 新增 `20004 微信 API 限频超时` / `30003 OOM/timeout`
- 错误日志自动脱敏: 手机号 / 邮箱 / access_token 走 `redact` 配置

### 4.2 安全 (必做清单)

| 项 | 实现 | 验收 |
|----|------|------|
| 越权防护 | 任何 `findFirst/update/delete` 强制带 `tenantId`; `TenantScopeGuard` 单元测试覆盖 17 模块 | 静态扫描 0 警告 |
| RBAC | `@RequirePermission('follower:write')` 装饰器; 权限矩阵从 DB 加载 | CI 校验每个 controller 方法都有声明 |
| 限流 | Redis 滑动窗口, per-tenant 100/s + per-IP 50/s + per-route 自定义 | 压测 200 req/s 不雪崩 |
| 审计 | 敏感操作 (授权回收/批量删除/支付/导出) 写 `audit_logs`, 含 actor/target/ip/UA/结果 | 100% 覆盖 |
| 入参强校验 | Zod 100% 覆盖 | CI grep `body: any` = 0 |
| 加密 | 微信凭证 AES-256-GCM (升级 V1 的 CBC); ENCRYPTION_KEY 轮转文档 | 文档 + 单测 |
| 密钥 | .env.production 不入 git; CI 跑 secret scan | gitleaks/trufflehog 0 命中 |
| 依赖漏洞 | `pnpm audit --prod` + 严重级阻断 | CI 失败则 merge 失败 |
| HTTPS | Nginx + Let's Encrypt (V1 已有), 加 HSTS/CSP/X-Frame-Options | 扫描 header A+ |
| 数据导出 | 异步任务 + 临时签名 URL, 24h 过期 | 单测覆盖 |

### 4.3 鉴权矩阵 (V2.0 落地的最小集合)

| 角色 | 范围 | 关键权限 |
|------|------|---------|
| `super_admin` | 平台 | 全部 |
| `tenant_owner` | 单租户 | 全部 |
| `tenant_admin` | 单租户 | 除计费/成员管理外全部 |
| `operator` | 单租户 | 粉丝/消息/素材/菜单/内容 (写) |
| `analyst` | 单租户 | 数据只读 |
| `agent` | 单租户 | 仅 Agent 任务 + LLM 调用 |

---

## 5. 测试策略与里程碑

### 5.1 测试金字塔 (V2.0 必达)

```
                       ┌──────────────┐
                       │   E2E (10)   │  Playwright + supertest
                       │  关键流 3+   │  登录/授权/群发/支付
                       ├──────────────┤
                       │ 集成 (40)    │  controller + service + DB
                       │  模块边界    │  Redis/BullMQ 真连
                       ├──────────────┤
                       │ 单元 (200+)  │  17 模块全覆盖
                       │  纯函数     │  工具/Zod schema/限流
                       └──────────────┘
```

**覆盖率目标**:

| 层级 | 目标 | 阻断门槛 |
|------|------|---------|
| 单元 (service 内部) | ≥ 70% 行 | 60% |
| 集成 (service+prisma) | ≥ 50% 行 | 40% |
| E2E (关键流) | 100% 关键流覆盖 | 0 失败 |
| 总计 | ≥ 60% 行 | 50% |

**TDD 流程**:

1. 写失败测试 → 红
2. 改最小代码 → 绿
3. 重构 → 整洁
4. 每个模块 PR 必须带测试 + 截图 (如前端)

### 5.2 里程碑 (V2.0 拆 6 个 sprint, 每个 sprint 可独立发布)

| Sprint | 主题 | 关键产出 | 体量 (人日, 参考) |
|--------|------|---------|------------------|
| S1 | 测试底座 | 17 service 补单测到 60% / Jest 配齐 / coverage 报告 / CI 集成 | 8-12 |
| S2 | DTO/Zod 全量 | 17 controller 100% Zod / ESLint 强制 / OpenAPI 同步 | 6-8 |
| S3 | 可观测性 | OTel + Prometheus + pino + Grafana 4 看板 + 告警 | 8-10 |
| S4 | 安全加固 | RBAC + 越权扫描 + 限流 + 审计 + secret scan + 漏洞扫描 | 8-10 |
| S5 | CI + 部署回滚 | Blue/Green 脚本 / migration 双向 / rollback 演练 / CI 全套 | 6-8 |
| S6 | 架构清理 + E2E | 抽象接口基类 / 循环依赖扫描 / 3 条 E2E 关键流 + 文档 | 6-8 |

### 5.3 V2.0 → V2.1 过渡判定 ("地基稳了")

- 全部 6 个 sprint 完成 + 全部成功标准达成
- 连续 2 周生产无 P0/P1 事故
- 至少有 1 次回滚演练成功
- Grafana 看板被团队日常使用

### 5.4 风险与回退

| 风险 | 概率 | 缓解 |
|------|------|------|
| 补 DTO 时发现 API 行为不一致 | 高 | 视为 bug 修复, 先标 deprecation 1 个版本 |
| OTel 引入增加延迟 | 中 | 采样率默认 10%, 可配置 |
| 蓝绿部署对宝塔不友好 | 中 | 准备 2 套 (蓝绿 + 简单 pm2 reload) 切换方案 |
| 团队 TDD 习惯没建立 | 中 | S1 配对编程 1 周; code review 强制 review 测试 |
| MinIO 与生产部署位置冲突 | 中 | 复用 V1 文档路径, 检查 env 即可 |

---

## 6. 后续 spec 衔接 (V2.1 / V2.2 候选)

V2.0 完成后, V2.1 候选 (届时再写 spec):

- **AIGC 路径**: 内容生成 (公众号文章 + 配图) / 智能客服 (RAG) / Agent 工作流深化
- **CRM 路径**: RFM 分群 / 转化漏斗 / 渠道二维码 / 裂变 / 营销自动化

V2.2 候选:

- 多渠道: 视频号 / 小程序 / 企业微信 / 抖音

本 spec 不展开 V2.1+ 业务方向。

---

## 7. 变更记录

| 版本 | 日期 | 变更 | 作者 |
|------|------|------|------|
| v2.0.0-design | 2026-06-02 | 初稿, 基于 V1 实测数据 | Architecture |
