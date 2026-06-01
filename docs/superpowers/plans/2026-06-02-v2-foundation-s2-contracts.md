# V2.0 S2 — DTO/Zod 全量校验 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** V1 17 个 controller 全部用 Zod schema 声明入参/出参, 0 个 `body: any`, CI 静态扫描阻断。

**Architecture:** 集中式 `common/contracts/` 仓, 每个模块一个 `*.contract.ts`, 通过 `ZodValidationPipe` + `@ZodBody` / `@ZodQuery` / `@ZodResponse` 装饰器落地。OpenAPI 自动同步到 Swagger。

**Tech Stack:** zod 3 / @nestjs/swagger 7 / nestjs-zod 1.x (社区 pipe)

**Spec:** [../specs/2026-06-02-v2-foundation-design.md §2.2 §2.3](../specs/2026-06-02-v2-foundation-design.md)

**前置依赖:** S1 (测试底座 — 用 S1 的 helper 写 pipe 测试)

**本 sprint 不动:**
- 不动业务 service 实现
- 不动 prisma schema (除非审计需要, 走 ADR 单独评审)
- 不动前端 (S6 才动)

---

## 累计文件结构 (本 sprint 创建)

```
apps/server/src/common/contracts/            # 全部 NEW
├── index.ts                                 # 统一导出
├── pagination.contract.ts                   # 共用分页 schema
├── response.contract.ts                     # ApiResponse<T> 通用 schema
├── auth.contract.ts
├── tenant.contract.ts
├── platform.contract.ts
├── account.contract.ts
├── follower.contract.ts
├── message.contract.ts
├── material.contract.ts
├── menu.contract.ts
├── analytics.contract.ts
├── agent.contract.ts
├── content.contract.ts
├── campaign.contract.ts
├── llm.contract.ts
├── payment.contract.ts
├── oss.contract.ts
└── team.contract.ts

apps/server/src/common/pipes/
└── zod-validation.pipe.ts                   # NEW (核心)

apps/server/src/common/decorators/
├── zod-body.decorator.ts                    # NEW
├── zod-query.decorator.ts                   # NEW
└── zod-response.decorator.ts                # NEW

apps/server/src/common/swagger/
└── zod-to-swagger.ts                        # NEW (自动生成 OpenAPI)

apps/server/test/unit/common/
├── zod-validation.pipe.spec.ts              # NEW
└── swagger-sync.spec.ts                     # NEW

apps/server/eslint-rules/                    # NEW (本地规则)
└── no-body-any.js                           # NEW

.eslintrc.json                               # MODIFY
.github/workflows/ci.yml                     # MODIFY (加扫描 step)
```

---

## Task 1: 安装依赖 + Zod pipe 骨架

**Files:**
- Modify: `apps/server/package.json`
- Create: `apps/server/src/common/pipes/zod-validation.pipe.ts`
- Create: `apps/server/src/common/contracts/response.contract.ts`
- Create: `apps/server/src/common/contracts/pagination.contract.ts`

- [ ] **Step 1: 装 nestjs-zod + swagger 相关**

```bash
cd apps/server
pnpm add nestjs-zod@1 zod@3
pnpm add -D @anatine/zod-openapi@2
```

- [ ] **Step 2: 写 response.contract.ts**

```typescript
// apps/server/src/common/contracts/response.contract.ts
import { z } from 'zod';

export const ApiResponseSchema = <T extends z.ZodTypeAny>(data: T) =>
  z.object({
    code: z.number().int(),
    message: z.string(),
    data: data.optional(),
    trace_id: z.string().uuid().optional(),
  });

export const PaginatedSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    list: z.array(item),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    page_size: z.number().int().positive(),
  });

export const ErrorSchema = z.object({
  code: z.number().int(),
  message: z.string(),
  errors: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
  trace_id: z.string().uuid().optional(),
});
```

- [ ] **Step 3: 写 pagination.contract.ts**

```typescript
// apps/server/src/common/contracts/pagination.contract.ts
import { z } from 'zod';

export const PageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});
export type PageQuery = z.infer<typeof PageQuerySchema>;
```

- [ ] **Step 4: 写 zod-validation.pipe.ts (核心)**

```typescript
// apps/server/src/common/pipes/zod-validation.pipe.ts
import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ZodSchema } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}
  transform(value: unknown, _meta: ArgumentMetadata) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const errors = result.error.issues.map(i => ({ field: i.path.join('.'), message: i.message }));
      throw new BadRequestException({
        code: 10001,
        message: '参数校验失败',
        errors,
      });
    }
    return result.data;
  }
}
```

- [ ] **Step 5: 写失败测试 (pipe)**

```typescript
// apps/server/test/unit/common/zod-validation.pipe.spec.ts
import { ZodValidationPipe } from '../../../src/common/pipes/zod-validation.pipe';
import { z } from 'zod';
import { BadRequestException } from '@nestjs/common';

describe('ZodValidationPipe', () => {
  const schema = z.object({ name: z.string().min(1), age: z.number().int().min(0) });
  const pipe = new ZodValidationPipe(schema);

  it('returns parsed data on success', () => {
    expect(pipe.transform({ name: 'A', age: 1 })).toEqual({ name: 'A', age: 1 });
  });
  it('throws BadRequest with field errors', () => {
    try {
      pipe.transform({ name: '', age: -1 });
      fail('expected throw');
    } catch (e: any) {
      expect(e).toBeInstanceOf(BadRequestException);
      const body = e.getResponse();
      expect(body.code).toBe(10001);
      expect(body.errors.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 6: 跑测试**

Run: `cd apps/server && pnpm test zod-validation.pipe`
Expected: PASS 2 tests.

- [ ] **Step 7: 提交**

```bash
git add apps/server/src/common/pipes apps/server/src/common/contracts package.json
git commit -m "feat(server): ZodValidationPipe + response/pagination contract"
```

---

## Task 2: Zod 装饰器三件套

**Files:**
- Create: `apps/server/src/common/decorators/zod-body.decorator.ts`
- Create: `apps/server/src/common/decorators/zod-query.decorator.ts`
- Create: `apps/server/src/common/decorators/zod-response.decorator.ts`

- [ ] **Step 1: 写 zod-body.decorator.ts**

```typescript
import { createParamDecorator, ExecutionContext, BadRequestException } from '@nestjs/common';
import { ZodSchema } from 'zod';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';

export const ZodBody = (schema: ZodSchema) =>
  createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    return new ZodValidationPipe(schema).transform(req.body, { type: 'body' });
  })();
```

- [ ] **Step 2: 写 zod-query.decorator.ts**

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ZodSchema } from 'zod';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';

export const ZodQuery = (schema: ZodSchema) =>
  createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    return new ZodValidationPipe(schema).transform(req.query, { type: 'query' });
  })();
```

- [ ] **Step 3: 写 zod-response.decorator.ts (出参 schema 标记)**

```typescript
import { SetMetadata } from '@nestjs/common';
import { ZodSchema } from 'zod';

export const ZOD_RESPONSE_KEY = 'zod:response';
export const ZodResponse = (schema: ZodSchema) => SetMetadata(ZOD_RESPONSE_KEY, schema);
```

- [ ] **Step 4: 提交**

```bash
git add apps/server/src/common/decorators
git commit -m "feat(server): ZodBody/Query/Response 装饰器"
```

---

## Task 3: 集成进 app.module (全局 pipe)

**Files:**
- Modify: `apps/server/src/main.ts`
- Modify: `apps/server/src/app.module.ts`

- [ ] **Step 1: main.ts 启用全局 Swagger (如未启用)**

在 `main.ts` 找到 Swagger 启动段, 确保有:

```typescript
const config = new DocumentBuilder()
  .setTitle('WXGZH API')
  .setVersion('2.0.0')
  .addBearerAuth()
  .build();
const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api/docs', app, document);
```

(若已有, 跳过。)

- [ ] **Step 2: 提交**

```bash
git commit -am "chore(server): ensure Swagger enabled (V2.0)"
```

---

## Task 4: 第 1 个 contract — auth.contract.ts (示例)

**Files:**
- Create: `apps/server/src/common/contracts/auth.contract.ts`
- Modify: `apps/server/src/modules/auth/auth.controller.ts`

- [ ] **Step 1: 写 auth.contract.ts**

```typescript
// apps/server/src/common/contracts/auth.contract.ts
import { z } from 'zod';

export const LoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(64),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const LoginOutputSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number().int().positive(),
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email(),
    avatar: z.string().url().optional(),
    roles: z.array(z.string()),
    permissions: z.array(z.string()),
  }),
});
export type LoginOutput = z.infer<typeof LoginOutputSchema>;

export const RefreshInputSchema = z.object({
  refresh_token: z.string().min(1),
});
```

- [ ] **Step 2: 修改 auth.controller.ts (用装饰器)**

找到 `login` 方法 (假定签名 `login(@Body() dto: LoginDto)`), 改为:

```typescript
@Post('login')
@ZodResponse(LoginOutputSchema)
async login(@ZodBody(LoginInputSchema) input: LoginInput) {
  return this.authService.login(input);
}
```

(原 `LoginDto` 可保留作为类型导出, 但 controller 不再用 `@Body()`.)

- [ ] **Step 3: 跑测试 + e2e**

```bash
cd apps/server && pnpm test
```

Expected: 全部通过 (S1 已有 e2e 覆盖此路径, 如未写则在 T3.5 补)。

- [ ] **Step 4: 提交**

```bash
git commit -am "feat(auth): Zod contract + ZodBody/Response on login"
```

---

## Task 5-12: 其余 8 个核心模块 contract + controller (tenant/platform/account/follower/message/material/menu/analytics)

每个模块一个 task, 流程:
1. Create `apps/server/src/common/contracts/<module>.contract.ts` (所有入参出参 Zod schema)
2. Modify `apps/server/src/modules/<module>/<module>.controller.ts` (用 `@ZodBody` / `@ZodQuery` / `@ZodResponse`)
3. 跑 `pnpm test` 全绿
4. Commit `feat(<module>): Zod contract + controller`

**每个 contract 必须包含**:
- ListQuery (复用 PageQuerySchema 扩展)
- CreateInput
- UpdateInput (partial of Create)
- Response (含 relations 子 schema)

**示例 follower.contract.ts 骨架**:

```typescript
// apps/server/src/common/contracts/follower.contract.ts
import { z } from 'zod';
import { PageQuerySchema } from './pagination.contract';

export const FollowerSchema = z.object({
  id: z.string(),
  openid: z.string(),
  nickname: z.string().nullable(),
  sex: z.number().int().min(0).max(2).nullable(),
  province: z.string().nullable(),
  subscribe: z.boolean(),
  subscribeAt: z.coerce.date().nullable(),
  tags: z.array(z.object({ id: z.string(), name: z.string(), color: z.string() })),
});
export type Follower = z.infer<typeof FollowerSchema>;

export const ListFollowersQuerySchema = PageQuerySchema.extend({
  tagId: z.string().optional(),
  keyword: z.string().optional(),
  sex: z.enum(['0', '1', '2']).optional(),
  province: z.string().optional(),
  subscribeSince: z.coerce.date().optional(),
  subscribeUntil: z.coerce.date().optional(),
});
export type ListFollowersQuery = z.infer<typeof ListFollowersQuerySchema>;

export const CreateTagInputSchema = z.object({
  name: z.string().min(1).max(32),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#1890ff'),
});
export const BatchTagInputSchema = z.object({
  tagId: z.string().min(1),
  followerIds: z.array(z.string().min(1)).min(1).max(500),
});
```

**controller 改造示例**:

```typescript
@Get()
async list(@ZodQuery(ListFollowersQuerySchema) q: ListFollowersQuery) {
  return this.followerService.getFollowers(...);
}
```

逐个模块完成后, 共 8 个 commit。

---

## Task 13-17: 高级 5 模块 contract (agent/content/campaign/llm/payment)

每个模块一个 task, 流程同 Task 5-12。

agent.contract.ts 额外包含 Skill/Agent/AgentTask schema。

llm.contract.ts 包含 ChatInput / ChatOutput / Usage schema。

payment.contract.ts 包含 OrderInput / NotifyInput (微信回调) / OrderOutput schema。

---

## Task 18: OpenAPI 同步校验 (Swagger 与 Zod 不一致 = 失败)

**Files:**
- Create: `apps/server/src/common/swagger/zod-to-swagger.ts`
- Create: `apps/server/test/unit/common/swagger-sync.spec.ts`

- [ ] **Step 1: 写 zod-to-swagger.ts (用 @anatine/zod-openapi)**

```typescript
// apps/server/src/common/swagger/zod-to-swagger.ts
import { extendZodWithOpenApi } from '@anatine/zod-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);
export { z };
```

在 `main.ts` 最顶上 `import './common/swagger/zod-to-swagger';`

- [ ] **Step 2: 写 swagger-sync.spec.ts (snapshot 校验)**

```typescript
// apps/server/test/unit/common/swagger-sync.spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { AppModule } from '../../../src/app.module';

describe('Swagger OpenAPI 同步', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });
  afterAll(async () => { await app.close(); });

  it('生成的 OpenAPI 与 Zod contract 一致', () => {
    const config = new DocumentBuilder().setTitle('WXGZH').setVersion('2.0.0').build();
    const doc = SwaggerModule.createDocument(app, config);
    const snapshot = path.join(__dirname, '__snapshots__', 'openapi.json');
    if (!fs.existsSync(path.dirname(snapshot))) fs.mkdirSync(path.dirname(snapshot), { recursive: true });
    if (process.env.UPDATE_SNAPSHOT) {
      fs.writeFileSync(snapshot, JSON.stringify(doc, null, 2));
    } else {
      const expected = JSON.parse(fs.readFileSync(snapshot, 'utf-8'));
      expect(doc.paths).toEqual(expected.paths);
    }
  });
});
```

- [ ] **Step 3: 跑测试生成 snapshot**

```bash
cd apps/server
UPDATE_SNAPSHOT=1 pnpm test swagger-sync
pnpm test swagger-sync   # 第二次应 PASS
```

- [ ] **Step 4: 提交**

```bash
git add apps/server/src/common/swagger apps/server/test/unit/common
git commit -m "feat(server): OpenAPI 同步校验 (zod-openapi + snapshot)"
```

---

## Task 19: ESLint 规则 — 禁 `body: any` / `query: any`

**Files:**
- Create: `apps/server/eslint-rules/no-any-input.js`
- Modify: `.eslintrc.json`
- Modify: `apps/server/package.json` (eslint-plugin-local-rules)

- [ ] **Step 1: 装本地规则支持**

```bash
cd apps/server
pnpm add -D eslint-plugin-local-rules
```

- [ ] **Step 2: 写 no-any-input.js**

```javascript
// apps/server/eslint-rules/no-any-input.js
module.exports = {
  meta: { type: 'problem', docs: { description: '禁止 @Body() / @Query() / @Param() 不带类型' } },
  create(context) {
    return {
      Decorator(node) {
        if (!node.expression || node.expression.callee?.name !== 'Body' &&
            node.expression.callee?.name !== 'Query' &&
            node.expression.callee?.name !== 'Param') return;
        const arg = node.expression.arguments?.[0];
        if (!arg) {
          context.report({ node, message: '必须使用 @ZodBody/@ZodQuery/@ZodParam 装饰器代替 @Body()/@Query()/@Param()' });
        } else if (arg.type === 'TSAnyKeyword' || (arg.type === 'TSTypeReference' && arg.typeName?.name === 'any')) {
          context.report({ node, message: '禁止 any 类型入参; 使用 Zod schema' });
        }
      },
    };
  },
};
```

- [ ] **Step 3: 注册到 .eslintrc.json**

```json
{
  "plugins": ["local-rules"],
  "rules": {
    "local-rules/no-any-input": "error"
  }
}
```

- [ ] **Step 4: 跑 lint**

```bash
cd apps/server && pnpm lint
```

Expected: **失败**, 列出所有 `body: any` / `@Body() dto` 无类型位置。

- [ ] **Step 5: 修复每个 lint 错 (按本 sprint 16 个 task 已完成, 此时应 0 错)**

如还有错, 逐个改 controller 用 `@ZodBody`。

- [ ] **Step 6: 跑 lint 全绿 + 提交**

```bash
cd apps/server && pnpm lint
git add apps/server/eslint-rules .eslintrc.json package.json
git commit -m "chore(server): eslint 禁 @Body()/@Query() 无类型"
```

---

## Task 20: CI 集成 lint + swagger 同步

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: 加 swagger-sync 到 test job**

在 `test:` job 内, `pnpm test` 之后加:

```yaml
      - name: Verify OpenAPI snapshot
        run: cd apps/server && pnpm test swagger-sync
```

- [ ] **Step 2: 加 lint 阻断 (已有 lint job, 确保失败时 PR 失败)**

确认 `lint` job 的 `pnpm lint` 不带 `--fix` 或 `|| true`。

- [ ] **Step 3: 推 PR 验证**

```bash
git add .github/workflows/ci.yml
git commit -m "ci(server): swagger-sync + lint gate"
git push
```

---

## Task 21: 全量验证

- [ ] **Step 1: 本地全量**

```bash
cd apps/server
pnpm install
pnpm lint         # 0 错
pnpm test         # 全绿
pnpm test swagger-sync  # 全绿
```

- [ ] **Step 2: 统计 DTO 覆盖率**

```bash
cd apps/server
echo "未使用 Zod 的 controller 方法数:"
grep -rE "@(Body|Query|Param)\(\)" src/modules/ | wc -l
echo "应输出 0"
```

- [ ] **Step 3: 更新顶层 plan 标记 S2 完成**

---

## 完工判定 (S2)

- [ ] `pnpm lint` 0 错
- [ ] `pnpm test` 全绿
- [ ] `pnpm test swagger-sync` snapshot 匹配
- [ ] 17 个 controller 100% 用 `@ZodBody` / `@ZodQuery`
- [ ] `common/contracts/` 17 个文件齐
- [ ] OpenAPI 在 `/api/docs` 在线

→ S2 完成, 进入 S3 (可观测性)
