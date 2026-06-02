# 微信公众号第三方运营管理平台 — 技术架构设计

> 版本: v1.0.0 | 日期: 2026-05-29 | 作者: Architecture Team

---

## 1. 架构决策总览

### 1.1 第一性原理推导

**核心约束（不可变更的物理/数学事实）**:
1. 微信 API 限制：component_access_token 2000 次/天，authorizer_access_token 2h 过期，回调 5s 超时
2. 多租户数据隔离：每个租户的数据不可交叉，查询必须 100% 准确注入 `tenantId`
3. 数据延迟：微信用户分析接口 T+1，不可假设实时性
4. MVP 团队规模：2-3 开发者，运维成本敏感

**推导结论**:
- MVP 阶段采用 **模块化单体（Modular Monolith）** 而非分布式微服务
- 理由：微服务在 MVP 阶段增加部署/调试/事务复杂度，但团队规模无法消化；清晰的 NestJS Module 边界允许未来低摩擦拆分
- Kafka 替换为 **BullMQ（Redis-based）**：满足 MVP 异步任务需求，运维零成本增量
- 单 PostgreSQL 数据库 + Schema 逻辑隔离：满足数据隔离需求，运维简单

### 1.2 架构演进路线

```
MVP (现在)        →  V1 (100+ 租户)  →  V2 (1000+ 租户)
─────────────────────────────────────────────────────
模块化单体         独立服务部署        全面微服务
BullMQ            保留                引入 Kafka
单 PG             读写分离            分库分表
单 Redis          哨兵模式            Cluster
无 ES             ES 搜索             ES 集群
```

---

## 2. Monorepo 工程结构

```
wxgzh-platform/
├── apps/
│   └── server/                     # NestJS 后端主应用
│       ├── src/
│       │   ├── main.ts             # 入口 + Swagger + ValidationPipe
│       │   ├── app.module.ts       # 根模块
│       │   ├── common/             # 公共基础设施
│       │   │   ├── decorators/     # @CurrentUser, @TenantId, @Public
│       │   │   ├── filters/        # HttpExceptionFilter（统一响应格式）
│       │   │   ├── guards/         # JwtAuthGuard, TenantGuard
│       │   │   ├── interceptors/   # LoggingInterceptor, TraceIdInterceptor
│       │   │   ├── middleware/      # TenantMiddleware（注入租户上下文）
│       │   │   ├── pipes/          # WechatMessagePipe（微信消息验签解密）
│       │   │   └── dto/            # PaginatedDto, ApiResponse<T>
│       │   ├── config/             # 环境变量 + 配置校验 (zod)
│       │   │   └── config.module.ts
│       │   ├── prisma/             # PrismaModule + PrismaService
│       │   │   ├── prisma.module.ts
│       │   │   └── prisma.service.ts
│       │   ├── modules/            # 业务模块（每个 Module 独立目录）
│       │   │   ├── auth/           # 租户认证（登录/注册/JWT）
│       │   │   ├── tenant/         # 租户管理
│       │   │   ├── platform/       # 第三方平台授权管理 (M01)
│       │   │   ├── account/        # 多公众号管理 (M02)
│       │   │   ├── follower/       # 粉丝管理 (M03)
│       │   │   ├── message/        # 消息管理 (M04)
│       │   │   ├── material/       # 素材管理 (M05)
│       │   │   ├── menu/           # 菜单管理 (M06)
│       │   │   └── analytics/      # 数据统计 (M07)
│       │   ├── integrations/       # 外部集成
│       │   │   └── wechat/         # 微信 API 统一封装
│       │   │       ├── wechat.module.ts
│       │   │       ├── wechat.service.ts        # API 调用 + Token 管理
│       │   │       ├── wechat.crypto.service.ts # 加解密 (AES/CBC/PKCS7)
│       │   │       ├── wechat.webhook.controller.ts # 事件接收 URL
│       │   │       └── wechat.types.ts          # 微信 API 类型定义
│       │   └── tasks/              # 定时任务 (BullMQ)
│       │       ├── token-refresh.processor.ts   # Token 刷新任务
│       │       ├── sync-data.processor.ts       # 数据同步任务
│       │       └── tag-rule.processor.ts        # 标签规则执行
│       ├── test/
│       └── Dockerfile
├── apps/
│   └── web/                        # React 前端应用
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── router.tsx          # 路由配置 + 懒加载
│       │   ├── components/
│       │   │   ├── ui/             # 二次封装的 Ant Design 组件
│       │   │   ├── layout/         # MainLayout, Sidebar, Header
│       │   │   └── common/         # 通用业务组件
│       │   ├── pages/              # 页面（按模块组织）
│       │   │   ├── platform/       # M01
│       │   │   ├── accounts/       # M02
│       │   │   ├── followers/      # M03
│       │   │   ├── messages/       # M04
│       │   │   ├── materials/      # M05
│       │   │   ├── menu/           # M06
│       │   │   └── dashboard/      # M07
│       │   ├── hooks/              # 自定义 Hooks
│       │   ├── services/           # API 请求封装（zod 校验返回值）
│       │   ├── stores/             # Zustand stores
│       │   ├── types/              # 前端类型定义
│       │   └── utils/              # 工具函数
│       ├── public/
│       ├── vite.config.ts
│       └── Dockerfile
├── packages/
│   └── shared/                     # 前后端共享类型 + 校验
│       ├── src/
│       │   ├── types/              # API 响应类型、枚举
│       │   ├── schemas/            # Zod schemas（运行时校验）
│       │   └── constants/          # 共享常量（错误码、微信错误码）
│       ├── package.json
│       └── tsconfig.json
├── prisma/
│   ├── schema.prisma               # 数据库模型定义
│   ├── migrations/                 # 迁移文件（自动生成）
│   └── seed.ts                     # 种子数据
├── docker/
│   ├── docker-compose.yml          # 本地开发环境
│   ├── postgres/
│   │   └── init.sql
│   └── redis/
│       └── redis.conf
├── .github/
│   └── workflows/
│       ├── ci.yml                  # Lint + Build + Test
│       └── deploy.yml              # 部署流水线
├── pnpm-workspace.yaml
├── turbo.json                      # Turborepo 配置
├── package.json
├── tsconfig.base.json
└── .env.example
```

---

## 3. 模块化单体内部设计

### 3.1 模块依赖图

```
                    ┌─────────────┐
                    │  AppModule  │
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
    ┌──────▼──────┐ ┌─────▼──────┐ ┌──────▼──────┐
    │  AuthModule │ │TenantModule│ │ CommonInfra │
    │  (JWT/RBAC) │ │ (租户CRUD) │ │ (Guards等)  │
    └──────┬──────┘ └────────────┘ └──────────────┘
           │
    ┌──────▼──────────────────────────────────────┐
    │              PlatformModule (M01)            │
    │  依赖: WechatModule, PrismaModule           │
    │  提供: IPlatformService (被 Account 依赖)    │
    └──────┬──────────────────────────────────────┘
           │
    ┌──────▼──────────────────────────────────────┐
    │              AccountModule (M02)             │
    │  依赖: PlatformModule, WechatModule          │
    │  提供: IAccountService (被其余模块依赖)      │
    └──────┬──────────────────────────────────────┘
           │
    ┌──────┴──────┬──────────┬──────────┬──────────┐
    │             │          │          │          │
┌───▼───┐  ┌──────▼───┐ ┌───▼───┐ ┌───▼────┐ ┌───▼──────┐
│Follower│  │ Message  │ │Material│ │ Menu   │ │Analytics │
│ (M03) │  │  (M04)   │ │ (M05)  │ │ (M06)  │ │  (M07)   │
└───────┘  └──────────┘ └───────┘ └────────┘ └──────────┘
```

**依赖规则**:
- 所有业务模块 → 依赖 `AccountModule`（获取当前操作的 authorizer）
- 所有业务模块 → 依赖 `WechatModule`（调用微信 API）
- 业务模块之间 **不允许直接相互依赖**（通过 EventEmitter 解耦）

### 3.2 同步 vs 异步通信边界

| 场景 | 方式 | 理由 |
|------|------|------|
| 前端请求 → 后端 | 同步 HTTP REST | 用户等待响应 |
| Token 刷新 | 同步（带 Redis 分布式锁） | 必须获得 Token 才能继续 |
| 粉丝数据同步 | 异步 BullMQ | 微信接口慢，不阻塞用户 |
| 标签规则执行 | 异步 BullMQ 定时触发 | 批量处理，非实时要求 |
| 群发消息 | 异步 BullMQ | 微信异步处理，需轮询结果 |
| 数据统计拉取 | 异步 BullMQ 定时触发 | T+1 数据，非实时 |

### 3.3 EventEmitter 模块间通信

```typescript
// 模块间解耦事件（NestJS EventEmitter）
export const WechatEvents = {
  AUTHORIZATION_SUCCEEDED: 'wechat.authorization.succeeded',  // 授权成功 → AccountModule 同步信息
  AUTHORIZATION_EXPIRED:   'wechat.authorization.expired',    // 授权到期 → 通知 + 清理
  TICKET_RECEIVED:         'wechat.ticket.received',           // Ticket 到达 → PlatformModule 处理
} as const;
```

---

## 4. 数据架构

### 4.1 多租户隔离策略

```
策略: Shared Database + TenantId Column (共享数据库 + 租户ID列)

选择理由（MVP）:
- 运维简单：单个数据库实例
- 成本最低：无需额外实例
- 开发效率：Prisma 原生支持中间件注入 tenantId

实现方式:
- TenantMiddleware 从 JWT 提取 tenantId → 挂载到 AsyncLocalStorage
- PrismaService 通过 $transaction 扩展自动注入 WHERE tenantId = $ctx.tenantId
- 所有查询在 Prisma Client 层面强制隔离，业务代码无感知

未来演进（V2）:
- 大租户独立 Schema / 独立数据库实例
- 基于 tenantId 哈希的动态数据源路由
```

### 4.2 缓存策略

| 数据 | 存储位置 | TTL | 刷新策略 |
|------|----------|-----|----------|
| component_access_token | Redis | 7000s | 定时任务提前 200s 刷新 |
| authorizer_access_token | Redis | 7000s | 定时任务提前 200s 刷新 |
| 公众号基本信息 | Redis | 3600s | 写操作时主动失效 |
| 粉丝统计数据（看板） | Redis | 300s | 定时任务计算 + 缓存 |
| 微信 API 限频计数器 | Redis | 滑动窗口 | — |
| 消息去重 MsgId | Redis | 86400s | SET NX 自动过期 |

### 4.3 数据库索引策略

```
-- B-tree: 外键 + 等值查询
CREATE INDEX idx_authorizers_tenant_status ON authorizers(tenant_id, status);
CREATE INDEX idx_followers_authorizer_openid ON followers(authorizer_id, openid);

-- BRIN: 时间范围查询（数据统计）
CREATE INDEX idx_followers_created_brin ON followers USING BRIN(created_at);
CREATE INDEX idx_messages_created_brin ON messages USING BRIN(created_at);

-- GIN: JSONB 查询（标签规则）
CREATE INDEX idx_tag_rules_conditions ON tag_rules USING GIN(conditions);

-- 全文搜索（素材名称、关键词回复）
CREATE INDEX idx_materials_name_fts ON materials USING GIN(to_tsvector('simple', name));
```

---

## 5. 安全架构

### 5.1 认证流程

```
[React SPA] ──POST /auth/login──▶ [NestJS]
  { email, password }               │
                                    ├─ 验证凭据（bcrypt compare）
                                    ├─ 生成 JWT (sub=userId, tenantId, roles)
                                    ├─ 生成 Refresh Token (存 DB + Redis)
                                    └─ 返回 { access_token, refresh_token, expires_in }

[React SPA] ──请求任何 API──▶ [JwtAuthGuard]
  Authorization: Bearer <token>     │
                                    ├─ 验证 JWT 签名 + 过期
                                    ├─ 提取 tenantId → AsyncLocalStorage
                                    └─ 挂载 currentUser → request.user
```

### 5.2 数据加密

| 数据 | 算法 | 密钥管理 |
|------|------|----------|
| component_appsecret | AES-256-GCM | 环境变量 ENCRYPTION_KEY |
| authorizer_access_token | AES-256-GCM | 同上 |
| authorizer_refresh_token | AES-256-GCM | 同上 |
| encodingAesKey | AES-256-GCM | 同上 |
| 用户密码 | bcrypt (cost=12) | — |

### 5.3 S4 安全加固栈 (V2.0)

**已完成 9 个 task**, 详见 [runbooks/security.md](runbooks/security.md):

| 层 | 组件 | 路径 | 状态 |
|----|------|------|------|
| RBAC | `PERMISSIONS` 常量矩阵 + `@RequirePermission` 装饰器 | `common/security/permissions.ts` | ✅ |
| Guard | `PermissionGuard` (AND 语义) + `TenantScopeGuard` | `common/security/permission.guard.ts` | ✅ |
| 限流 | Redis 滑动窗口 `SlidingWindowLimiter` + `@RateLimit` 装饰器 | `common/ratelimit/sliding-window.ts` | ✅ |
| 审计 | `AuditService` (写 audit_logs) + `AuditInterceptor` + `@AuditLog` | `common/security/audit.service.ts` | ✅ |
| 加密 | `CryptoService` (AES-256-GCM, 兼容 CBC) | `common/security/crypto.service.ts` | ✅ |
| 越权扫描 | `tenant-leak-scan.ts` (自研) | `apps/server/scripts/` | ✅ |
| CI | `.github/workflows/security.yml` (3 job) | `.github/workflows/` | ✅ |

**基线状态 (S4 完工):**
- 38/38 单元测试全绿
- 0 Lint errors
- 越权扫描: 53 blocking + 100 warning (后续 sprint 月度修复)
- pnpm audit: 10 high (lodash transitive, 后续 sprint 升级)

---

## 6. 部署架构

### 6.1 MVP 部署拓扑

```
                    ┌──────────────┐
                    │   Nginx      │  (TLS 终止 + 静态资源)
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
     ┌────────▼───┐  ┌────▼─────┐  ┌───▼────────┐
     │  React SPA │  │  NestJS  │  │  MinIO      │
     │  (静态)    │  │  (API)   │  │  (素材存储)  │
     └────────────┘  └────┬─────┘  └────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
   ┌─────▼─────┐   ┌──────▼──────┐   ┌──────▼──────┐
   │ PostgreSQL │   │   Redis     │   │   BullMQ    │
   │   (数据)   │   │ (缓存/队列) │   │  (Worker)   │
   └───────────┘   └─────────────┘   └─────────────┘
```

### 6.2 Docker Compose 服务

```yaml
# docker/docker-compose.yml
services:
  postgres:    # PostgreSQL 16 + PgBouncer (transaction mode)
  redis:       # Redis 7 (缓存 + BullMQ)
  minio:       # MinIO (S3-compatible 对象存储)
  server:      # NestJS API (开发: hot-reload, 生产: node)
  web:         # Nginx serving React SPA + 反向代理 API
  worker:      # BullMQ Worker (独立进程，可选)
```

---

## 7. 关键技术决策记录

| ID | 决策 | 备选方案 | 选择理由 |
|----|------|----------|----------|
| ADR-001 | MVP 使用模块化单体 | 微服务 | 团队规模小，运维成本敏感；模块边界清晰可未来拆分 |
| ADR-002 | BullMQ 替代 Kafka | Kafka/RabbitMQ | MVP 异步任务量低，BullMQ 基于 Redis 零额外运维 |
| ADR-003 | 共享数据库 + tenantId | 独立数据库/独立 Schema | MVP 租户少，运维简单，Prisma 中间件天然支持 |
| ADR-004 | Prisma 而非 TypeORM | TypeORM/Drizzle | 类型安全最佳，迁移工具成熟，与 NestJS 集成最简 |
| ADR-005 | Zod 双向校验 | class-validator only | 前后端共享校验逻辑，运行时安全 |
| ADR-006 | Zustand + TanStack Query | Redux Toolkit | 更少样板代码，更符合 React 18 范式 |

---

## 8. 微信集成关键设计

### 8.1 Token 刷新分布式锁

```
刷新 authorizer_access_token 流程:

1. 业务请求到达 → WechatService.getAuthorizerToken(authorizerId)
2. 检查 Redis 缓存: GET token:{authorizerId}
3. 缓存命中 → 直接返回
4. 缓存未命中 → 尝试获取分布式锁:
   SET token:lock:{authorizerId} <instance_id> NX EX 10
5. 获取锁成功 → 调用微信 API 刷新 → 更新 Redis → 释放锁
6. 获取锁失败 → 自旋等待 100ms → 回到步骤 2（重试最多 3 次）
7. 重试耗尽 → 抛出异常「Token 刷新超时」
```

### 8.2 微信消息回调处理

```
微信服务器 → POST /webhook/wechat/{componentAppId}
  │
  ├─ WechatMessagePipe
  │   ├─ 验证签名（SHA1）
  │   ├─ 解密消息体（AES/CBC/PKCS7 → XML）
  │   └─ 解析 XML → WechatEventDto
  │
  ├─ WechatWebhookController
  │   └─ 5 秒内返回 "success"
  │
  └─ 异步处理（EventEmitter）
      ├─ component_verify_ticket → PlatformService 存储 + 刷新 component_token
      ├─ authorized → PlatformService 换取 authorizer_token + 同步基本信息
      ├─ unauthorized → PlatformService 标记 revoked
      └─ 消息/事件 → MessageModule 处理自动回复
```

---
