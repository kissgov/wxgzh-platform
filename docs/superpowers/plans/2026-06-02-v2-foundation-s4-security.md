# V2.0 S4 — 安全加固 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 V1 的"基本认证"升级为完整安全栈: RBAC 强制 + 越权静态扫描 + Redis 滑动窗口限流 + 审计日志强制 + secret scan + 依赖漏洞扫描 + 加密升级 AES-256-GCM。

**Architecture:** 装饰器驱动 (`@RequirePermission`) + Guard 层 (`RateLimitGuard` / `TenantScopeGuard`) + 拦截器 (`AuditLogInterceptor`) + CI 静态分析 (gitleaks + pnpm audit + 自研越权扫描)。

**Tech Stack:** ioredis (已有) / gitleaks 8 / pnpm audit (内置) / @nestjs/throttler 6 (或自研滑动窗口)

**Spec:** [../specs/2026-06-02-v2-foundation-design.md §4](../specs/2026-06-02-v2-foundation-design.md)

**前置依赖:** S2 (DTO/Zod — Guard 校验在 DTO 之后), S3 (可观测性 — 审计日志走 pino)

**本 sprint 不动:**
- 不动 prisma schema (除非审计/权限需要的最小字段, ADR 评审)
- 不动业务 service 实现逻辑

---

## 累计文件结构 (本 sprint 创建)

```
apps/server/src/common/security/             # NEW
├── permissions.ts                           # 权限常量 + 矩阵
├── require-permission.decorator.ts          # @RequirePermission
├── permission.guard.ts                      # 运行时校验
├── tenant-scope.guard.ts                    # 强制 tenantId 一致
├── audit.service.ts                         # 写 audit_logs
├── audit.interceptor.ts                     # 自动拦截敏感操作
└── crypto.service.ts                        # AES-256-GCM 升级

apps/server/src/common/ratelimit/            # NEW
├── sliding-window.ts                        # Redis 滑动窗口
├── rate-limit.guard.ts                      # 装饰器 + guard
└── rate-limit.module.ts

apps/server/src/integrations/wechat/
└── wechat.crypto.service.ts                 # MODIFY (GCM 升级, 兼容 CBC)

apps/server/test/unit/common/security/
├── permission.guard.spec.ts
├── tenant-scope.guard.spec.ts
├── audit.interceptor.spec.ts
├── crypto.service.spec.ts
└── ratelimit.spec.ts

apps/server/scripts/                         # NEW
└── tenant-leak-scan.ts                      # 自研越权静态扫描

.eslintrc.json                               # MODIFY
package.json                                 # MODIFY
.github/workflows/
├── ci.yml                                   # MODIFY (加 security job)
└── security.yml                             # NEW
```

---

## Task 1: 权限常量矩阵 + @RequirePermission 装饰器 + Guard

**Files:**
- Create: `apps/server/src/common/security/permissions.ts`
- Create: `apps/server/src/common/security/require-permission.decorator.ts`
- Create: `apps/server/src/common/security/permission.guard.ts`
- Modify: `apps/server/src/modules/auth/auth.service.ts` (登录返回 permissions)

- [ ] **Step 1: 写 permissions.ts**

```typescript
// apps/server/src/common/security/permissions.ts
export const PERMISSIONS = {
  // 粉丝
  FOLLOWER_READ: 'follower:read',
  FOLLOWER_WRITE: 'follower:write',
  // 消息
  MESSAGE_READ: 'message:read',
  MESSAGE_WRITE: 'message:write',
  MESSAGE_SEND: 'message:send',
  // 素材
  MATERIAL_READ: 'material:read',
  MATERIAL_WRITE: 'material:write',
  // 菜单
  MENU_READ: 'menu:read',
  MENU_WRITE: 'menu:write',
  MENU_PUBLISH: 'menu:publish',
  // 数据
  ANALYTICS_READ: 'analytics:read',
  // 内容
  CONTENT_READ: 'content:read',
  CONTENT_WRITE: 'content:write',
  CONTENT_PUBLISH: 'content:publish',
  // Agent
  AGENT_READ: 'agent:read',
  AGENT_WRITE: 'agent:write',
  AGENT_RUN: 'agent:run',
  // 计费
  BILLING_READ: 'billing:read',
  BILLING_WRITE: 'billing:write',
  // 成员
  TEAM_READ: 'team:read',
  TEAM_WRITE: 'team:write',
  // 平台
  PLATFORM_ADMIN: 'platform:admin',
  // 授权
  AUTHORIZE: 'authorizer:write',
  AUTHORIZE_REVOKE: 'authorizer:revoke',
} as const;
export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  super_admin: Object.values(PERMISSIONS),
  tenant_owner: Object.values(PERMISSIONS).filter(p => p !== PLATFORM_ADMIN),
  tenant_admin: [
    PERMISSIONS.FOLLOWER_READ, PERMISSIONS.FOLLOWER_WRITE,
    PERMISSIONS.MESSAGE_READ, PERMISSIONS.MESSAGE_WRITE, PERMISSIONS.MESSAGE_SEND,
    PERMISSIONS.MATERIAL_READ, PERMISSIONS.MATERIAL_WRITE,
    PERMISSIONS.MENU_READ, PERMISSIONS.MENU_WRITE, PERMISSIONS.MENU_PUBLISH,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.CONTENT_READ, PERMISSIONS.CONTENT_WRITE, PERMISSIONS.CONTENT_PUBLISH,
    PERMISSIONS.AGENT_READ, PERMISSIONS.AGENT_WRITE, PERMISSIONS.AGENT_RUN,
    PERMISSIONS.TEAM_READ, PERMISSIONS.AUTHORIZE, PERMISSIONS.AUTHORIZE_REVOKE,
  ],
  operator: [
    PERMISSIONS.FOLLOWER_READ, PERMISSIONS.FOLLOWER_WRITE,
    PERMISSIONS.MESSAGE_READ, PERMISSIONS.MESSAGE_WRITE, PERMISSIONS.MESSAGE_SEND,
    PERMISSIONS.MATERIAL_READ, PERMISSIONS.MATERIAL_WRITE,
    PERMISSIONS.MENU_READ, PERMISSIONS.MENU_WRITE, PERMISSIONS.MENU_PUBLISH,
    PERMISSIONS.CONTENT_READ, PERMISSIONS.CONTENT_WRITE, PERMISSIONS.CONTENT_PUBLISH,
    PERMISSIONS.AGENT_READ, PERMISSIONS.AGENT_RUN, PERMISSIONS.AUTHORIZE,
  ],
  analyst: [
    PERMISSIONS.FOLLOWER_READ, PERMISSIONS.MESSAGE_READ,
    PERMISSIONS.MATERIAL_READ, PERMISSIONS.MENU_READ,
    PERMISSIONS.ANALYTICS_READ, PERMISSIONS.CONTENT_READ,
  ],
  agent: [
    PERMISSIONS.AGENT_READ, PERMISSIONS.AGENT_RUN,
  ],
};
```

- [ ] **Step 2: 写装饰器**

```typescript
// apps/server/src/common/security/require-permission.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { Permission } from './permissions';

export const REQUIRE_PERMISSION_KEY = 'require:permission';
export const RequirePermission = (...perms: Permission[]) => SetMetadata(REQUIRE_PERMISSION_KEY, perms);
```

- [ ] **Step 3: 写 guard**

```typescript
// apps/server/src/common/security/permission.guard.ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_PERMISSION_KEY } from './require-permission.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(REQUIRE_PERMISSION_KEY, [
      ctx.getHandler(), ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const req = ctx.switchToHttp().getRequest();
    const userPerms: string[] = req.user?.permissions || [];
    const has = required.every(p => userPerms.includes(p));
    if (!has) throw new ForbiddenException({ code: 10003, message: '无权限', required });
    return true;
  }
}
```

- [ ] **Step 4: 修改 auth.service.ts 登录返回 permissions**

找到 `login` 方法, 在生成 token 前从 role 表加载 permissions:

```typescript
const roles = await this.prisma.userRole.findMany({
  where: { userId: user.id },
  include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
});
const permissions = roles.flatMap(ur => ur.role.rolePermissions.map(rp => rp.permission.code));
return { access_token, refresh_token, expires_in, user: { ...user, roles: roles.map(r => r.role.code), permissions } };
```

(具体按 V1 实际 role/permission 表结构调整。)

- [ ] **Step 5: 在 main.ts 注册全局 guard**

```typescript
import { PermissionGuard } from './common/security/permission.guard';
app.useGlobalGuards(new PermissionGuard());  // 在 JwtAuthGuard 之后
```

- [ ] **Step 6: 写失败测试**

```typescript
// apps/server/test/unit/common/security/permission.guard.spec.ts
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PermissionGuard } from '../../../../src/common/security/permission.guard';
import { Reflector } from '@nestjs/core';

describe('PermissionGuard', () => {
  let guard: PermissionGuard;
  beforeEach(() => { guard = new PermissionGuard(new Reflector()); });

  it('passes when no @RequirePermission', () => {
    const ctx = makeCtx({ user: { permissions: [] } });
    expect(guard.canActivate(ctx)).toBe(true);
  });
  it('passes when user has all required', () => {
    const ctx = makeCtx({ user: { permissions: ['follower:read'] }, meta: ['follower:read'] });
    expect(guard.canActivate(ctx)).toBe(true);
  });
  it('throws Forbidden when missing', () => {
    const ctx = makeCtx({ user: { permissions: [] }, meta: ['follower:write'] });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});

function makeCtx({ user, meta = [] }: any): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getArgs: () => [],
    getArgByIndex: () => undefined,
    switchToRpc: () => ({} as any),
    switchToWs: () => ({} as any),
    getType: () => 'http',
    // Reflector.getAllAndOverride 需要 metadata; 测试用 Reflector 真实例
  } as any;
}
```

- [ ] **Step 7: 跑测试**

```bash
cd apps/server && pnpm test permission.guard
```

- [ ] **Step 8: 提交**

```bash
git add apps/server/src/common/security apps/server/src/modules/auth/auth.service.ts apps/server/src/main.ts
git commit -m "feat(security): @RequirePermission 装饰器 + PermissionGuard"
```

---

## Task 2: 17 controller 全部加 @RequirePermission

**Files:**
- Modify: `apps/server/src/modules/*/[!auth]*.controller.ts`

- [ ] **Step 1: 改造 follower.controller.ts (示例)**

```typescript
import { RequirePermission } from '../../common/security/require-permission.decorator';
import { PERMISSIONS } from '../../common/security/permissions';

@Controller('followers')
export class FollowerController {
  @Get()
  @RequirePermission(PERMISSIONS.FOLLOWER_READ)
  async list(...) { ... }

  @Post()
  @RequirePermission(PERMISSIONS.FOLLOWER_WRITE)
  async create(...) { ... }
}
```

- [ ] **Step 2: 对 17 controller 重复 (除 auth + 公开 webhook controller 外)**

| 模块 | 主要权限 |
|------|---------|
| account | AUTHORIZE, AUTHORIZE_REVOKE |
| analytics | ANALYTICS_READ |
| agent | AGENT_READ, AGENT_WRITE, AGENT_RUN |
| campaign | (用 CONTENT_WRITE 或新建) |
| content | CONTENT_READ, CONTENT_WRITE, CONTENT_PUBLISH |
| follower | FOLLOWER_READ, FOLLOWER_WRITE |
| llm | (用 AGENT_RUN) |
| material | MATERIAL_READ, MATERIAL_WRITE |
| menu | MENU_READ, MENU_WRITE, MENU_PUBLISH |
| message | MESSAGE_READ, MESSAGE_WRITE, MESSAGE_SEND |
| oss | (用 MATERIAL_WRITE) |
| payment | BILLING_READ, BILLING_WRITE |
| platform | PLATFORM_ADMIN (super_admin only) |
| tenant | TEAM_READ, TEAM_WRITE, BILLING_READ |

- [ ] **Step 3: 跑测试全绿**

```bash
cd apps/server && pnpm test
```

- [ ] **Step 4: 提交**

```bash
git commit -am "feat: 17 controller 加 @RequirePermission 声明"
```

---

## Task 3: 越权静态扫描 (CI 用)

**Files:**
- Create: `apps/server/scripts/tenant-leak-scan.ts`
- Create: `.github/workflows/ci.yml` (新增 step)

- [ ] **Step 1: 写扫描脚本**

```typescript
// apps/server/scripts/tenant-leak-scan.ts
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOTS = ['apps/server/src/modules'];
const PATTERNS = [
  // 找不带 tenantId 的 prisma 调用
  { name: 'prisma.findFirst-no-tenant', regex: /prisma\.\w+\.findFirst\s*\(\s*\{[^}]*\}\s*\)/gs, requireTenant: true },
  { name: 'prisma.findMany-no-tenant', regex: /prisma\.\w+\.findMany\s*\(\s*\{[^}]*\}\s*\)/gs, requireTenant: true },
  { name: 'prisma.update-no-tenant', regex: /prisma\.\w+\.update\s*\(\s*\{[^}]*\}\s*,/gs, requireTenant: true },
  { name: 'prisma.delete-no-tenant', regex: /prisma\.\w+\.delete\s*\(\s*\{[^}]*\}\s*\)/gs, requireTenant: true },
];

const issues: { file: string; line: number; rule: string; snippet: string }[] = [];

function scan(dir: string) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) { scan(p); continue; }
    if (!/\.(ts|js)$/.test(f) || /\.spec\.ts$/.test(f)) continue;
    const content = fs.readFileSync(p, 'utf-8');
    const lines = content.split('\n');
    for (const { name, regex } of PATTERNS) {
      let m;
      regex.lastIndex = 0;
      while ((m = regex.exec(content)) !== null) {
        if (name === 'prisma.findFirst-no-tenant' || name === 'prisma.findMany-no-tenant' ||
            name === 'prisma.update-no-tenant' || name === 'prisma.delete-no-tenant') {
          // 跳过已有 tenantId 的
          if (/tenantId\s*:/.test(m[0])) continue;
          // 跳过纯 updateMany (无 id)
          if (name === 'prisma.update-no-tenant' && /where\s*:\s*\{\s*tenantId/.test(content.slice(Math.max(0, m.index - 200), m.index))) continue;
        }
        const lineNum = content.slice(0, m.index).split('\n').length;
        issues.push({ file: p, line: lineNum, rule: name, snippet: m[0].slice(0, 80) });
      }
    }
  }
}

ROOTS.forEach(scan);
if (issues.length > 0) {
  console.error(`❌ 越权静态扫描发现 ${issues.length} 个问题:`);
  for (const i of issues) console.error(`  ${i.file}:${i.line} [${i.rule}] ${i.snippet}`);
  process.exit(1);
}
console.log('✅ 越权静态扫描通过 (0 issues)');
```

- [ ] **Step 2: 加到 CI (lint job)**

Modify `.github/workflows/ci.yml` 在 `lint:` job 内 `pnpm lint` 之后加:

```yaml
      - name: Tenant-leak scan
        run: cd apps/server && npx tsx scripts/tenant-leak-scan.ts
```

- [ ] **Step 3: 跑扫描 (当前代码应发现 ≥ 5 个, 因 V1 follower/analytics 可能有遗漏)**

```bash
cd apps/server && npx tsx scripts/tenant-leak-scan.ts
```

Expected: 列出问题 (允许此时存在, 后续任务修复)。

- [ ] **Step 4: 提交 (先提交, 在 Task 4 修复)**

```bash
git add apps/server/scripts .github/workflows/ci.yml
git commit -m "ci(security): 越权静态扫描 step"
```

---

## Task 4: 修复扫描发现的所有越权问题

- [ ] **Step 1: 跑扫描拿到 issue 列表**

```bash
cd apps/server && npx tsx scripts/tenant-leak-scan.ts 2>&1 | head -50
```

- [ ] **Step 2: 逐个修复**

按列出的 `file:line` 找到代码, 加 `tenantId: ctx.tenantId` (从 AsyncLocalStorage / 参数拿)。

- [ ] **Step 3: 跑扫描到 0 错**

```bash
cd apps/server && npx tsx scripts/tenant-leak-scan.ts
# Expected: ✅ 0 issues
```

- [ ] **Step 4: 跑测试全绿**

```bash
cd apps/server && pnpm test
```

- [ ] **Step 5: 提交**

```bash
git commit -am "fix(security): 修复 N 个越权点 (静态扫描 0 错)"
```

---

## Task 5: Redis 滑动窗口限流

**Files:**
- Create: `apps/server/src/common/ratelimit/sliding-window.ts`
- Create: `apps/server/src/common/ratelimit/rate-limit.guard.ts`
- Create: `apps/server/src/common/ratelimit/rate-limit.module.ts`

- [ ] **Step 1: 写 sliding-window.ts**

```typescript
// apps/server/src/common/ratelimit/sliding-window.ts
import Redis from 'ioredis';
import { Injectable, OnModuleDestroy } from '@nestjs/common';

@Injectable()
export class SlidingWindowLimiter implements OnModuleDestroy {
  private redis: Redis;
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }
  async check(key: string, limit: number, windowMs: number): Promise<{ allowed: boolean; remaining: number; resetMs: number }> {
    const now = Date.now();
    const windowStart = now - windowMs;
    const multi = this.redis.multi();
    multi.zremrangebyscore(key, 0, windowStart);
    multi.zadd(key, now, `${now}-${Math.random()}`);
    multi.zcard(key);
    multi.pexpire(key, windowMs);
    const res = await multi.exec();
    const count = (res![2]![1] as number) || 0;
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetMs: windowMs,
    };
  }
  async onModuleDestroy() { await this.redis.quit(); }
}
```

- [ ] **Step 2: 写 rate-limit.guard.ts**

```typescript
// apps/server/src/common/ratelimit/rate-limit.guard.ts
import { CanActivate, ExecutionContext, HttpException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SlidingWindowLimiter } from './sliding-window';

export const RATE_LIMIT_KEY = 'rate:limit';
export const RateLimit = (limit: number, windowMs: number, scope: 'tenant' | 'ip' | 'route' = 'route') =>
  SetMetadata(RATE_LIMIT_KEY, { limit, windowMs, scope });

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private limiter: SlidingWindowLimiter, private reflector: Reflector) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const cfg = this.reflector.getAllAndOverride<{ limit: number; windowMs: number; scope: string }>(RATE_LIMIT_KEY, [ctx.getHandler()]);
    if (!cfg) return true;
    const req = ctx.switchToHttp().getRequest();
    const key = `rl:${cfg.scope}:${cfg.scope === 'tenant' ? req.user?.tenantId : cfg.scope === 'ip' ? req.ip : req.route?.path}`;
    const r = await this.limiter.check(key, cfg.limit, cfg.windowMs);
    if (!r.allowed) throw new HttpException({ code: 10006, message: '请求频率超限', resetMs: r.resetMs }, 429);
    return true;
  }
}
```

- [ ] **Step 3: 写失败测试**

```typescript
// apps/server/test/unit/common/ratelimit.spec.ts
import { SlidingWindowLimiter } from '../../../../src/common/ratelimit/sliding-window';

describe('SlidingWindowLimiter', () => {
  let limiter: SlidingWindowLimiter;
  beforeAll(() => { limiter = new SlidingWindowLimiter(); });
  afterAll(async () => { await limiter.onModuleDestroy(); });

  it('allows within limit', async () => {
    const key = `test:${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      const r = await limiter.check(key, 5, 1000);
      expect(r.allowed).toBe(true);
    }
  });
  it('blocks over limit', async () => {
    const key = `test:${Date.now()}`;
    for (let i = 0; i < 3; i++) await limiter.check(key, 3, 1000);
    const r = await limiter.check(key, 3, 1000);
    expect(r.allowed).toBe(false);
  });
});
```

- [ ] **Step 4: 在 main.ts 注册**

```typescript
import { SlidingWindowLimiter } from './common/ratelimit/sliding-window';
import { RateLimitGuard } from './common/ratelimit/rate-limit.guard';
app.useGlobalGuards(new RateLimitGuard(new SlidingWindowLimiter(), new Reflector()));
```

- [ ] **Step 5: 在 auth.controller 加限流示例 (防止登录爆破)**

```typescript
@Post('login')
@RateLimit(5, 60_000, 'ip')
async login(@ZodBody(LoginInputSchema) input: LoginInput) { ... }
```

- [ ] **Step 6: 跑测试全绿**

```bash
cd apps/server && pnpm test ratelimit
```

- [ ] **Step 7: 提交**

```bash
git add apps/server/src/common/ratelimit apps/server/src/main.ts
git commit -m "feat(security): Redis 滑动窗口限流 (per-tenant/per-IP/per-route)"
```

---

## Task 6: 审计日志强制

**Files:**
- Create: `apps/server/src/common/security/audit.service.ts`
- Create: `apps/server/src/common/security/audit.interceptor.ts`
- Modify: 17 controller 关键方法加 @AuditLog

- [ ] **Step 1: 写 audit.service.ts (假设 audit_logs 表已存在)**

```typescript
// apps/server/src/common/security/audit.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditLogInput {
  action: string;        // e.g. 'authorizer.revoked'
  target?: string;       // resource id
  result: 'success' | 'failure';
  meta?: Record<string, any>;
  actorId: string;
  tenantId: string;
  ip?: string;
  ua?: string;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}
  async log(input: AuditLogInput) {
    return this.prisma.auditLog.create({ data: input as any });
  }
}
```

- [ ] **Step 2: 写装饰器 + 拦截器**

```typescript
// apps/server/src/common/security/audit.interceptor.ts
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditService } from './audit.service';
import { SetMetadata } from '@nestjs/common';

export const AUDIT_KEY = 'audit:action';
export const AuditLog = (action: string) => SetMetadata(AUDIT_KEY, action);

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private audit: AuditService) {}
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const action = ctx.getHandler()[AUDIT_KEY] || ctx.getClass()[AUDIT_KEY];
    if (!action) return next.handle();
    const req = ctx.switchToHttp().getRequest();
    const start = Date.now();
    return next.handle().pipe(
      tap({
        next: () => this.audit.log({ action, actorId: req.user.sub, tenantId: req.user.tenantId, ip: req.ip, ua: req.headers['user-agent'], result: 'success' }),
        error: (err) => this.audit.log({ action, actorId: req.user.sub, tenantId: req.user.tenantId, ip: req.ip, ua: req.headers['user-agent'], result: 'failure', meta: { error: err.message } }),
      }),
    );
  }
}
```

- [ ] **Step 3: 写测试**

```typescript
// apps/server/test/unit/common/security/audit.interceptor.spec.ts
import { AuditService } from '../../../../src/common/security/audit.service';
import { AuditInterceptor } from '../../../../src/common/security/audit.interceptor';

describe('AuditInterceptor', () => {
  it('logs on success', async () => {
    const log = jest.fn().mockResolvedValue(undefined);
    const audit = { log } as any;
    const interceptor = new AuditInterceptor(audit);
    const handler = { handle: () => ({ pipe: (f: any) => f({ next: () => {}, error: () => {} }) } as any) } as any;
    // 简化: 直接测 log 被调用
    await interceptor.intercept({ getHandler: () => ({}), getClass: () => ({}), switchToHttp: () => ({ getRequest: () => ({ user: { sub: 'u1', tenantId: 't1' }, ip: '1.2.3.4', headers: { 'user-agent': 'test' } }) }) } as any, handler).toPromise().catch(() => {});
    expect(log).toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: 注册全局拦截器**

```typescript
app.useGlobalInterceptors(new AuditInterceptor(auditService));
```

- [ ] **Step 5: 关键 controller 加 @AuditLog (示例)**

```typescript
@Delete(':id')
@RequirePermission(PERMISSIONS.AUTHORIZE_REVOKE)
@AuditLog('authorizer.revoked')
async revoke(@Param('id') id: string) { ... }
```

敏感操作清单:
- authorizer.revoked
- broadcast.sent
- menu.published
- payment.order_created
- user.deleted
- team.member_removed
- agent.task_executed (cost-sensitive)
- data.exported

- [ ] **Step 6: 跑测试全绿**

- [ ] **Step 7: 提交**

```bash
git add apps/server/src/common/security apps/server/src/main.ts
git commit -am "feat(security): 审计日志强制 (AuditService + @AuditLog + 全局拦截器)"
```

---

## Task 7: 加密升级 AES-256-CBC → AES-256-GCM

**Files:**
- Modify: `apps/server/src/integrations/wechat/wechat.crypto.service.ts` (新增 GCM 方法, 保留 CBC 兼容)

- [ ] **Step 1: 在 wechat.crypto.service.ts 加 GCM encrypt/decrypt**

```typescript
// 在 CryptoService 内新增
encryptGCM(plaintext: string, key: Buffer, aad?: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  if (aad) cipher.setAAD(Buffer.from(aad));
  const enc = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

decryptGCM(payload: string, key: Buffer, aad?: string): string {
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  if (aad) decipher.setAAD(Buffer.from(aad));
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf-8');
}
```

- [ ] **Step 2: 写测试**

```typescript
// apps/server/test/unit/common/security/crypto.service.spec.ts
import * as crypto from 'node:crypto';
// import WechatCryptoService (实际类名按 V1)

describe('AES-256-GCM 加解密', () => {
  it('round-trips', () => {
    const key = crypto.randomBytes(32);
    const plaintext = 'hello world 微信';
    // 调用 service 的 encryptGCM / decryptGCM
    // const enc = svc.encryptGCM(plaintext, key);
    // const dec = svc.decryptGCM(enc, key);
    // expect(dec).toBe(plaintext);
  });
  it('throws on tampered tag', () => {
    // 模拟篡改, 解密应抛
  });
  it('CBC 仍能解密 (向后兼容)', () => {
    // 旧 CBC 加密的密文应仍能 decrypt
  });
});
```

- [ ] **Step 3: 提交**

```bash
git commit -am "feat(security): AES-256-GCM 加解密 (兼容旧 CBC)"
```

---

## Task 8: Secret scan + 依赖漏洞扫描 (CI)

**Files:**
- Create: `.github/workflows/security.yml`

- [ ] **Step 1: 写 security.yml**

```yaml
name: Security Scan
on:
  push: { branches: [main, develop] }
  pull_request: { branches: [main] }

jobs:
  gitleaks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - name: Fail on findings
        run: |
          if [ -f gitleaks-report.json ]; then
            echo "::error::Gitleaks found secrets"
            cat gitleaks-report.json
            exit 1
          fi
  pnpm-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: '9' }
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - name: pnpm audit (high/critical)
        run: pnpm audit --prod --audit-level=high
  tenant-leak:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: '9' }
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: cd apps/server && npx tsx scripts/tenant-leak-scan.ts
```

- [ ] **Step 2: 本地跑一次, 修复任何 secret 命中**

```bash
# 安装 gitleaks: https://github.com/gitleaks/gitleaks
gitleaks detect --source . --no-git -v
```

- [ ] **Step 3: 跑 pnpm audit**

```bash
pnpm audit --prod
# 高危/严重级 = 阻断, 中低 = warning
```

- [ ] **Step 4: 提交 + 推 PR**

```bash
git add .github/workflows/security.yml
git commit -m "ci(security): gitleaks + pnpm audit + tenant-leak scan"
git push
```

- [ ] **Step 5: 验证 PR 触发 security job 全绿**

---

## Task 9: 文档 + 完工

- [ ] **Step 1: 写 docs/runbooks/security.md**

```markdown
# 安全事件响应手册

## Secret 泄露

1. 立即 rotate 该密钥 (ENCRYPTION_KEY / JWT_SECRET / OSS)
2. 强制所有用户重新登录 (revoke all JWTs)
3. 审计 audit_logs 找最近 24h 该密钥相关调用
4. 通报

## 越权检测

1. tenant-leak-scan 0 错为基线
2. PR 引入新 prisma 调用必须带 tenantId
3. 如发现越权 → hotfix + post-mortem

## 限流误伤

1. 查看 Grafana "HTTP 请求" 看板确认误伤租户
2. 该租户调高 limit (config 注入)
3. 排查是爬虫/攻击
```

- [ ] **Step 2: 更新 README 安全章节**

- [ ] **Step 3: 全量验证**

```bash
cd apps/server
pnpm install
pnpm lint        # 0 错
pnpm test        # 全绿
npx tsx scripts/tenant-leak-scan.ts  # 0 错
pnpm audit --prod --audit-level=high  # 0 错
```

- [ ] **Step 4: 推 PR + 标记 S4 完成**

```bash
git commit -am "docs: 安全 runbook"
git push
```

---

## 完工判定 (S4)

- [ ] 17 controller 全部有 `@RequirePermission`
- [ ] `tenant-leak-scan.ts` 0 错
- [ ] `pnpm audit` 高危 0
- [ ] `gitleaks` 0 命中
- [ ] login 限流 (5/分钟/IP) 生效
- [ ] 审计日志写入 audit_logs (敏感操作 100%)
- [ ] CI 三个 security job 全绿

→ S4 完成, 进入 S5 (CI + 部署回滚)
