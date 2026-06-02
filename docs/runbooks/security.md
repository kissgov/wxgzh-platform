# 安全事件响应手册 — S4 安全加固

> **范围:** V2.0 S4 sprint 实施的安全栈 (RBAC + 越权扫描 + 限流 + 审计 + 加密 + secret scan)
> **更新日期:** 2026-06-02

---

## 1. 当前安全基线

| 层 | 状态 | 说明 |
|----|------|------|
| 认证 (Auth) | ✅ V1 已有 | JWT + JwtAuthGuard, 401 未认证 |
| 授权 (RBAC) | ✅ S4 升级 | 16 个 controller 全部声明 `@RequirePermission`, 1 个 schema 矩阵 + 5 角色 |
| 越权扫描 (Tenant-leak) | ✅ S4 新增 | 静态扫描 `apps/server/scripts/tenant-leak-scan.ts`, CI gate |
| 限流 (RateLimit) | ✅ V1 已有 | `TenantThrottlerGuard` 基于 `@nestjs/throttler` (按 tenant+IP) |
| 审计日志 (Audit) | ✅ V1 已有 | `AuditLog` 表 + `audit_logs` 写入 |
| 加密 (Crypto) | ✅ V1 已有 | AES-256-GCM 已在 wechat.crypto 使用 |
| Secret scan | 🚧 S4 待补 | Task 8 计划 (gitleaks CI) |
| 依赖漏洞扫描 | 🚧 S4 待补 | Task 8 计划 (pnpm audit CI) |

---

## 2. RBAC 角色矩阵

`apps/server/src/common/security/permissions.ts` 是单一事实源。

| 角色 | 关键权限 |
|------|---------|
| `super_admin` | 全部 (含 PLATFORM_ADMIN) |
| `tenant_owner` | 全部 (除 PLATFORM_ADMIN) |
| `tenant_admin` | 业务操作 + 团队管理 + 授权 + 审计读取 |
| `operator` | 日常内容/消息/菜单/活动操作 |
| `analyst` | 只读 (粉丝/消息/素材/菜单/分析/审计) |
| `agent` | Agent 只读 + 执行 + LLM |

**新增/修改权限** 必须: ① ADR 评审 ② 同步 prisma seed ③ 跑越权扫描 ④ 更新本表。

---

## 3. 越权静态扫描

### 工具: `apps/server/scripts/tenant-leak-scan.ts`

**基线状态 (S4 完工时):**
- 53 blocking (update/delete 类缺 tenantId)
- 100 warning (create 缺 tenantId / findFirst/findMany 字面量无 tenantId)
- 0 review hints

### 扫描规则

| 规则 | 阻断 | 说明 |
|------|------|------|
| `prisma.X.update-no-tenant` | ✅ | update/updateMany 必须 where 含 tenantId |
| `prisma.X.delete-no-tenant` | ✅ | delete/deleteMany 必须 where 含 tenantId |
| `prisma.X.create-no-tenant-warn` | ⚠️ | create/createMany data 应含 tenantId (不阻断) |
| `prisma.X.findFirst-no-tenant-warn` | ⚠️ | findFirst/findMany 常使用 where 变量 (人工 review) |

### 豁免机制

| 方式 | 适用场景 |
|------|---------|
| `SYSTEM_MODELS` 白名单 | 平台级表 (auditLog, permission, subscriptionPlan, componentApp, tenant) |
| `/admin/`、`/platform/` 路径 | 平台管理路径, super_admin 角色保护 |
| `// tenant-allow` 注释 | 显式声明豁免 (调用前 1 行, 须含理由) |
| Nested where `where: { x: { tenantId } }` | 关系限定, 自动识别 |

### Sprint 范围 vs 后续修复

**S4 已修 7 个高危点:**
- `account.service.ts:116, 130` (accountGroup.update 缺 tenantId → 加复合 where)
- `tenant.service.ts:104, 107` (user.update → 加复合 where)
- `tenant.service.ts:110` (userRole.deleteMany → 加 nested where)
- `tenant.service.ts:119` (userAuthorizer.deleteMany → 加 nested where)
- `follower.service.ts:147` (followerTagRelation.deleteMany → 加 nested where)
- `approval.service.ts:195, 200` (approvalStep.updateMany + approvalRequest.update → 加 nested where)

**S4 范围外 (53 blocking + 100 warning):**
- 多数为 `prisma.X.update({ where: { id } })` 单 id 限定, 实际业务中已通过前置 findFirst 校验归属
- 风险等级: 低-中 (攻击者需先拿到目标 id, 而 id 通常来自本租户查询)
- 修复策略: 后续 sprint 月度计划 (每 sprint 减 10-15 个), 用 `// tenant-allow` 或加 nested where

---

## 4. Secret 泄露响应

1. **立即 rotate** 该密钥 (ENCRYPTION_KEY / JWT_SECRET / OSS / WeChat appSecret)
2. **强制重新登录**: `prisma.refreshToken.deleteMany({})` + 部署新 JWT_SECRET
3. **审计 24h**: `SELECT * FROM audit_logs WHERE action LIKE '%secret%' AND created_at > NOW() - INTERVAL '24 hours'`
4. **通报** 安全负责人 + 客户 (如客户密钥泄露)
5. **复盘**: 写入 post-mortem, 加 gitleaks pre-commit hook

---

## 5. 越权检测响应

1. **确认扫描告警** 是否真越权 (很多是 false positive)
2. **如真越权**: hotfix PR, 加 nested where 或复合 where
3. **回归测试**: 跑 `pnpm test` + 手动冒烟
4. **更新基线**: 修完后 `pnpm tsx scripts/tenant-leak-scan.ts` 重新跑, 目标 0 blocking

---

## 6. 限流误伤响应

1. **Grafana 看板** "HTTP 请求" 确认误伤租户/路径
2. **查看 ThrottlerModule** 配置 (`apps/server/src/app.module.ts`)
3. **临时调整** 该租户 limit (通过 config 注入):
   ```typescript
   ThrottlerModule.forRootAsync({
     useFactory: () => {
       const tier = getTenantTier(req.user.tenantId);
       return [{ ttl: 1000, limit: tier === 'enterprise' ? 1000 : 100 }];
     },
   });
   ```
4. **排查** 误伤原因: 爬虫/攻击/客户端 bug

---

## 7. 加密迁移 (AES-256-CBC → AES-256-GCM)

**状态**: V1 已用 AES-256-GCM (从 schema `appSecret`/`encodingAesKey` 注释可见)
**兼容**: wechat.crypto.service.ts 保留 CBC 解密方法以兼容历史数据

**迁移检查清单:**
- [ ] 所有加密字段已用 GCM (查 schema 注释)
- [ ] 解密方法对老 CBC 数据返回明文
- [ ] 加密 key 已 rotate (32 字节)
- [ ] 测试覆盖 GCM + CBC round-trip + 篡改检测

---

## 8. CI 安全门禁

| 门禁 | 工具 | 阻断级别 |
|------|------|---------|
| Lint | eslint | 0 error |
| TypeCheck | tsc | 0 error |
| Unit Test | jest | 0 fail |
| Tenant-leak scan | tsx script | 0 blocking |
| gitleaks | CI action | 0 leak |
| pnpm audit | pnpm | high/critical = 0 |

**Task 8 完成后**, 上述 6 项必须在 `pnpm test` + 6 个 CI job 全绿。

---

## 9. 联系

- 安全事件: #sec-incidents Slack 频道
- 安全负责人: @security-lead
- 紧急联系: PagerDuty "wxgzh-security"
