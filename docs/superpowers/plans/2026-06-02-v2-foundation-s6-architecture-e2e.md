# V2.0 S6 — 架构清理 + E2E 关键流 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 V1 业务模块的依赖关系梳理清晰 (消除循环依赖)、定义抽象基类规范、补全 MinIO 真实实现、3 条 E2E 关键流 (登录 / 授权 / 群发) 全绿。

**Architecture:** 模块边界 = abstract interface (token provider / storage / payment gateway / wechat client) → V1 service 实现 → 循环依赖用 madge CI 阻断; 3 条 E2E 用 supertest + nock, Playwright 仅在确实需要浏览器时使用。

**Tech Stack:** madge 6 (循环依赖) / ts-morph 22 (类型抽取) / supertest 7 / nock 13 / testcontainers / @aws-sdk/client-s3 (MinIO)

**Spec:** [../specs/2026-06-02-v2-foundation-design.md §2.2 §3.3 §1.4-clarification](../specs/2026-06-02-v2-foundation-design.md)

**前置依赖:** S1 (测试), S2 (DTO/Zod)

**本 sprint 不动:**
- 不动业务功能
- 不动 prisma schema

---

## 累计文件结构 (本 sprint 创建)

```
apps/server/src/common/arch/                # NEW
├── abstract-service.ts                     # 业务 service 基类
├── abstract-controller.ts                  # controller 基类
├── module-boundary.types.ts                # 模块间允许的 token
└── cycle-detector.ts                       # 运行时检测 (开发模式)

scripts/
└── cycle-scan.sh                           # madge + ESLint plugin 跑

apps/server/src/integrations/
├── storage/
│   ├── storage.interface.ts                # NEW: IStorageProvider
│   ├── minio.provider.ts                   # NEW: 真实 MinIO
│   ├── local.provider.ts                   # NEW: 本地 FS (开发/测试)
│   └── storage.module.ts                   # NEW
└── wechat/
    └── wechat.client.interface.ts          # NEW: IWechatClient (解耦)

apps/server/src/modules/oss/
├── oss.service.ts                          # MODIFY: 使用 IStorageProvider
└── oss.module.ts                           # MODIFY

apps/server/test/e2e/                        # NEW
├── helpers/
│   ├── e2e-app.ts                          # 启动 NestJS app
│   ├── wechat-mock.ts                      # 复用 S1
│   └── fixtures.ts
├── auth.e2e.spec.ts                        # 登录流
├── wechat-auth.e2e.spec.ts                 # 授权流
└── broadcast.e2e.spec.ts                   # 群发流

apps/server/package.json                     # MODIFY (test:e2e)
.github/workflows/e2e.yml                   # MODIFY (跑通)
.eslintrc.json                               # MODIFY (no-restricted-imports)
docs/architecture/
└── module-boundary.md                      # NEW
```

---

## Task 1: 循环依赖扫描 (madge + CI 阻断)

**Files:**
- Create: `scripts/cycle-scan.sh`
- Create: `.github/workflows/ci.yml` (新增 step)
- Create: `docs/architecture/module-boundary.md`

- [ ] **Step 1: 装 madge**

```bash
pnpm add -D madge@6
```

- [ ] **Step 2: 写 cycle-scan.sh**

```bash
#!/bin/bash
# scripts/cycle-scan.sh
set -e
cd "$(dirname "$0")/.."

echo "🔍 扫描后端模块循环依赖 ..."
CYCLE=$(npx madge --circular --extensions ts apps/server/src 2>&1)
if echo "$CYCLE" | grep -q "Circular"; then
  echo "$CYCLE"
  echo "❌ 发现循环依赖, 修复后才能合入"
  exit 1
fi
echo "✅ 无循环依赖"
```

- [ ] **Step 3: 跑扫描 (可能发现 V1 现有循环)**

```bash
chmod +x scripts/cycle-scan.sh
./scripts/cycle-scan.sh
```

如发现, 记录到 issue, 本任务不修 (避免 scope creep), 在 S6 后续 task 或 S2.5 处理。

- [ ] **Step 4: 写到 CI (lint job 末尾)**

Modify `.github/workflows/ci.yml` 在 `lint:` job 内 `pnpm lint` 之后加:

```yaml
      - name: Cycle scan
        run: ./scripts/cycle-scan.sh
```

- [ ] **Step 5: 写模块边界文档**

```markdown
# 模块依赖边界 (V2.0)

## 允许的依赖方向

\`\`\`
common/* (无业务依赖, 可被任何模块引用)
↓
common/arch (抽象基类, 不引具体业务)
↓
modules/* (业务模块, 可引 common, 但不互引)
↓
modules/integrations/* (微信/MinIO, 业务模块引)
\`\`\`

## 禁止

- module A 直接 import module B 的 service (用 EventEmitter 解耦)
- module A import module B 的 prisma model (用 contract 共享类型)
- module 跨级反向依赖

## 工具

\`\`\`bash
./scripts/cycle-scan.sh     # 循环依赖
pnpm depcruise apps/server/src  # 详细依赖图
\`\`\`
```

- [ ] **Step 6: 提交**

```bash
git add scripts/cycle-scan.sh docs/architecture/module-boundary.md package.json
git commit -m "feat(arch): madge 循环依赖扫描 + 模块边界规范"
```

---

## Task 2: 抽象基类 (AbstractService / AbstractController)

**Files:**
- Create: `apps/server/src/common/arch/abstract-service.ts`
- Create: `apps/server/src/common/arch/abstract-controller.ts`

- [ ] **Step 1: 写 abstract-service.ts**

```typescript
// apps/server/src/common/arch/abstract-service.ts
import { Logger } from 'nestjs-pino';
import { Inject } from '@nestjs/common';

export abstract class AbstractService {
  @Inject() protected readonly logger: any; // 由 LoggerModule 注入 (pino)
  protected get log() { return this.logger; }

  // 业务方法必须用此方法包装
  protected async safe<T>(name: string, fn: () => Promise<T>, ctx?: Record<string, any>): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      this.log.debug({ name, durationMs: Date.now() - start, ...ctx }, `${name} ok`);
      return result;
    } catch (err: any) {
      this.log.error({ name, err: err.message, stack: err.stack, ...ctx }, `${name} failed`);
      throw err;
    }
  }
}
```

- [ ] **Step 2: 写 abstract-controller.ts**

```typescript
// apps/server/src/common/arch/abstract-controller.ts
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

export abstract class AbstractController {}

export const ProtectedController = () => UseGuards(JwtAuthGuard);
```

- [ ] **Step 3: 写测试**

```typescript
// apps/server/test/unit/common/arch/abstract-service.spec.ts
import { AbstractService } from '../../../../src/common/arch/abstract-service';

class TestService extends AbstractService {
  async doIt() { return this.safe('doIt', async () => 'ok'); }
  async fail() { return this.safe('fail', async () => { throw new Error('boom'); }); }
}

describe('AbstractService.safe', () => {
  it('returns result on success', async () => {
    const s = new TestService();
    s['logger'] = { debug: jest.fn(), error: jest.fn() };
    await expect(s.doIt()).resolves.toBe('ok');
  });
  it('throws and logs on failure', async () => {
    const s = new TestService();
    s['logger'] = { debug: jest.fn(), error: jest.fn() };
    await expect(s.fail()).rejects.toThrow('boom');
    expect(s['logger'].error).toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: 跑测试**

```bash
cd apps/server && pnpm test abstract-service
```

- [ ] **Step 5: 提交 (基类就绪, 不强制 V1 业务 service 改造, 留 V2.1)**

```bash
git add apps/server/src/common/arch
git commit -m "feat(arch): AbstractService + AbstractController 基类"
```

---

## Task 3: 抽象存储接口 IStorageProvider + MinIO 落地

**Files:**
- Create: `apps/server/src/integrations/storage/storage.interface.ts`
- Create: `apps/server/src/integrations/storage/minio.provider.ts`
- Create: `apps/server/src/integrations/storage/local.provider.ts`
- Create: `apps/server/src/integrations/storage/storage.module.ts`
- Modify: `apps/server/src/modules/oss/oss.service.ts`
- Modify: `apps/server/src/modules/oss/oss.module.ts`

- [ ] **Step 1: 装 MinIO SDK**

```bash
cd apps/server
pnpm add @aws-sdk/client-s3@3 @aws-sdk/s3-request-presigner@3
```

- [ ] **Step 2: 写 IStorageProvider**

```typescript
// apps/server/src/integrations/storage/storage.interface.ts
export interface PutObjectInput {
  key: string;
  body: Buffer | NodeJS.ReadableStream;
  contentType?: string;
  metadata?: Record<string, string>;
}
export interface PutObjectResult { key: string; url: string; etag?: string; }
export interface GetSignedUrlInput { key: string; expiresInSec: number; }
export interface IStorageProvider {
  put(input: PutObjectInput): Promise<PutObjectResult>;
  getSignedUrl(input: GetSignedUrlInput): Promise<string>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}
export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');
```

- [ ] **Step 3: 写 MinIO 实现**

```typescript
// apps/server/src/integrations/storage/minio.provider.ts
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { IStorageProvider, PutObjectInput, PutObjectResult, GetSignedUrlInput } from './storage.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class MinioStorageProvider implements IStorageProvider {
  private client: S3Client;
  private bucket: string;
  private publicBaseUrl: string;

  constructor() {
    this.client = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: 'us-east-1',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY!,
        secretAccessKey: process.env.S3_SECRET_KEY!,
      },
      forcePathStyle: true, // MinIO 兼容
    });
    this.bucket = process.env.S3_BUCKET || 'wxgzh';
    this.publicBaseUrl = process.env.S3_PUBLIC_BASE_URL || process.env.S3_ENDPOINT!;
  }

  async put(input: PutObjectInput): Promise<PutObjectResult> {
    const cmd = new PutObjectCommand({
      Bucket: this.bucket, Key: input.key, Body: input.body as any,
      ContentType: input.contentType, Metadata: input.metadata,
    });
    const res = await this.client.send(cmd);
    return { key: input.key, url: `${this.publicBaseUrl}/${this.bucket}/${input.key}`, etag: res.ETag };
  }
  async getSignedUrl(input: GetSignedUrlInput): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: input.key }), { expiresIn: input.expiresInSec });
  }
  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch { return false; }
  }
}
```

- [ ] **Step 4: 写 Local FS 实现 (开发/测试)**

```typescript
// apps/server/src/integrations/storage/local.provider.ts
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { IStorageProvider, PutObjectInput, PutObjectResult, GetSignedUrlInput } from './storage.interface';
import { Injectable } from '@nestjs/common';
import * as crypto from 'node:crypto';

@Injectable()
export class LocalStorageProvider implements IStorageProvider {
  private root: string;
  constructor() { this.root = process.env.LOCAL_STORAGE_DIR || '/tmp/wxgzh-storage'; }

  async put(input: PutObjectInput): Promise<PutObjectResult> {
    const full = path.join(this.root, input.key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    const body = Buffer.isBuffer(input.body) ? input.body : await this.streamToBuffer(input.body);
    await fs.writeFile(full, body);
    return { key: input.key, url: `file://${full}` };
  }
  async getSignedUrl(input: GetSignedUrlInput): Promise<string> {
    // 本地存储: 用短时 token
    const token = crypto.createHmac('sha256', process.env.LOCAL_STORAGE_TOKEN || 'dev').update(input.key + input.expiresInSec).digest('hex');
    return `/api/v1/local-storage/${encodeURIComponent(input.key)}?t=${input.expiresInSec}&s=${token}`;
  }
  async delete(key: string) { await fs.unlink(path.join(this.root, key)).catch(() => {}); }
  async exists(key: string) { try { await fs.access(path.join(this.root, key)); return true; } catch { return false; } }
  private async streamToBuffer(s: NodeJS.ReadableStream) { const chunks: Buffer[] = []; for await (const c of s) chunks.push(Buffer.from(c)); return Buffer.concat(chunks); }
}
```

- [ ] **Step 5: 写 module**

```typescript
// apps/server/src/integrations/storage/storage.module.ts
import { Module } from '@nestjs/common';
import { MinioStorageProvider } from './minio.provider';
import { LocalStorageProvider } from './local.provider';
import { STORAGE_PROVIDER } from './storage.interface';

@Module({
  providers: [
    { provide: STORAGE_PROVIDER, useClass: process.env.STORAGE_DRIVER === 'minio' ? MinioStorageProvider : LocalStorageProvider },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
```

- [ ] **Step 6: 改 oss.service.ts 用 IStorageProvider**

```typescript
// oss.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { STORAGE_PROVIDER, IStorageProvider } from '../../integrations/storage/storage.interface';

@Injectable()
export class OssService {
  constructor(@Inject(STORAGE_PROVIDER) private storage: IStorageProvider) {}
  async upload(key: string, body: Buffer, contentType: string) {
    return this.storage.put({ key, body, contentType });
  }
  async getUrl(key: string, expiresInSec: number = 3600) {
    return this.storage.getSignedUrl({ key, expiresInSec });
  }
  async delete(key: string) { return this.storage.delete(key); }
  async exists(key: string) { return this.storage.exists(key); }
}
```

- [ ] **Step 7: 写测试**

```typescript
// apps/server/test/unit/integrations/storage/local.provider.spec.ts
import { LocalStorageProvider } from '../../../../src/integrations/storage/local.provider';

describe('LocalStorageProvider', () => {
  it('put / exists / getSignedUrl / delete', async () => {
    const p = new LocalStorageProvider();
    process.env.LOCAL_STORAGE_DIR = '/tmp/wxgzh-test-' + Date.now();
    const buf = Buffer.from('hello world');
    const put = await p.put({ key: 'test/hello.txt', body: buf, contentType: 'text/plain' });
    expect(put.key).toBe('test/hello.txt');
    expect(await p.exists('test/hello.txt')).toBe(true);
    const url = await p.getSignedUrl({ key: 'test/hello.txt', expiresInSec: 60 });
    expect(url).toMatch(/\/api\/v1\/local-storage\//);
    await p.delete('test/hello.txt');
    expect(await p.exists('test/hello.txt')).toBe(false);
  });
});
```

- [ ] **Step 8: 跑测试 + 提交**

```bash
cd apps/server && pnpm test local.provider
git add apps/server/src/integrations/storage apps/server/src/modules/oss package.json
git commit -m "feat(storage): IStorageProvider 抽象 + MinIO + Local 落地"
```

---

## Task 4: 抽象微信客户端接口 IWechatClient

**Files:**
- Create: `apps/server/src/integrations/wechat/wechat.client.interface.ts`

- [ ] **Step 1: 写 IWechatClient**

```typescript
// apps/server/src/integrations/wechat/wechat.client.interface.ts
export interface IWechatClient {
  getAuthorizerToken(authorizerAppId: string): Promise<string>;
  sendBroadcast(authorizerAppId: string, payload: any): Promise<{ msgId: string }>;
  getUserList(authorizerAppId: string, nextOpenId?: string): Promise<{ openids: string[]; total: number; nextOpenId?: string }>;
  getUserInfo(authorizerAppId: string, openid: string): Promise<any>;
  createMenu(authorizerAppId: string, menu: any): Promise<void>;
  uploadMedia(authorizerAppId: string, type: 'image' | 'video' | 'voice' | 'thumb', body: Buffer, filename: string): Promise<{ mediaId: string; url: string }>;
}
export const WECHAT_CLIENT = Symbol('WECHAT_CLIENT');
```

- [ ] **Step 2: 在 wechat.module.ts 注册绑定**

```typescript
// 在 wechat.module.ts 的 providers 段
import { WECHAT_CLIENT } from './wechat.client.interface';
import { WechatClientImpl } from './wechat.client.impl';

{ provide: WECHAT_CLIENT, useClass: WechatClientImpl }
```

(WechatClientImpl 后续写 — 拆分现有 wechat.service.ts 的 API 调用部分; 防止本任务过大, 此处先建接口, 实施可在 PR 中拆分。)

- [ ] **Step 3: 提交**

```bash
git add apps/server/src/integrations/wechat/wechat.client.interface.ts apps/server/src/integrations/wechat/wechat.module.ts
git commit -m "feat(wechat): IWechatClient 接口 (后续 task 实现)"
```

---

## Task 5: E2E 测试基础设施

**Files:**
- Create: `apps/server/test/e2e/helpers/e2e-app.ts`
- Create: `apps/server/test/e2e/helpers/fixtures.ts`
- Modify: `apps/server/package.json`

- [ ] **Step 1: 加 supertest + e2e 配置**

```bash
cd apps/server
pnpm add -D supertest@7 @types/supertest@7
```

- [ ] **Step 2: 写 e2e-app.ts (启动 NestJS app)**

```typescript
// apps/server/test/e2e/helpers/e2e-app.ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { startOtel } from '../../../src/common/observability/otel';

let app: INestApplication;

export async function getE2EApp(): Promise<INestApplication> {
  if (app) return app;
  startOtel();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider('StorageProvider').useValue({ put: jest.fn().mockResolvedValue({ key: 'x', url: 'mock://x' }), getSignedUrl: jest.fn().mockResolvedValue('mock://x'), delete: jest.fn(), exists: jest.fn().mockResolvedValue(true) })
    .compile();
  app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  await app.init();
  return app;
}

export async function closeE2EApp() { await app?.close(); }
```

- [ ] **Step 3: 写 fixtures.ts (HTTP helpers)**

```typescript
// apps/server/test/e2e/helpers/fixtures.ts
import * as request from 'supertest';
import { getE2EApp } from './e2e-app';
import * as jwt from 'jsonwebtoken';

export function makeToken(userId: string, tenantId: string, roles: string[] = ['tenant_owner']) {
  return jwt.sign({ sub: userId, tenantId, roles }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
}

export async function httpGet(path: string, token?: string) {
  const app = await getE2EApp();
  return request(app.getHttpServer()).get(path).set('Authorization', token ? `Bearer ${token}` : '');
}
export async function httpPost(path: string, body: any, token?: string) {
  const app = await getE2EApp();
  return request(app.getHttpServer()).post(path).set('Authorization', token ? `Bearer ${token}` : '').send(body);
}
```

- [ ] **Step 4: 加 package.json script**

```json
{
  "test:e2e": "jest --config jest.config.ts --testPathPattern=test/e2e --runInBand"
}
```

- [ ] **Step 5: 提交**

```bash
git add apps/server/test/e2e apps/server/package.json
git commit -m "test(e2e): E2E 基础设施 (NestJS app + supertest + fixtures)"
```

---

## Task 6: E2E 流 1 — 登录流

**Files:**
- Create: `apps/server/test/e2e/auth.e2e.spec.ts`

- [ ] **Step 1: 写测试**

```typescript
import { getE2EApp, closeE2EApp } from './helpers/e2e-app';
import { httpGet, httpPost, makeToken } from './helpers/fixtures';
import { getPrisma, truncateAll } from '../helpers/prisma-test';
import { Factories } from '../helpers/factories';
import * as bcrypt from 'bcryptjs';

describe('E2E: 登录流', () => {
  beforeAll(async () => { await getE2EApp(); });
  afterAll(async () => { await closeE2EApp(); });
  beforeEach(async () => { await truncateAll(); });

  it('未登录访问受保护接口 → 401', async () => {
    const res = await httpGet('/api/v1/accounts');
    expect(res.status).toBe(401);
  });
  it('错误密码 → 401 + 错误码 10002', async () => {
    const t = await Factories.tenant();
    await Factories.user(t.id, { email: 'a@b.com' });
    const res = await httpPost('/api/v1/auth/login', { email: 'a@b.com', password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(10002);
  });
  it('正确凭据 → 200 + access_token + user 信息', async () => {
    const t = await Factories.tenant();
    const u = await Factories.user(t.id, { email: 'a@b.com' });
    const res = await httpPost('/api/v1/auth/login', { email: 'a@b.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data.access_token).toBeDefined();
    expect(res.body.data.user.email).toBe('a@b.com');
  });
  it('携带 token 访问受保护接口 → 200', async () => {
    const t = await Factories.tenant();
    const u = await Factories.user(t.id, { email: 'a@b.com' });
    const token = makeToken(u.id, t.id);
    const res = await httpGet('/api/v1/accounts', token);
    expect([200, 204]).toContain(res.status);
  });
  it('token 过期 → 401 + 错误码 10002', async () => {
    const expired = jwt.sign({ sub: 'u1', tenantId: 't1' }, process.env.JWT_SECRET, { expiresIn: '-1s' });
    const res = await httpGet('/api/v1/accounts', expired);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(10002);
  });
  it('refresh token 续签', async () => {
    // ... (略)
  });
});
```

- [ ] **Step 2: 跑测试**

```bash
cd apps/server && pnpm test:e2e auth.e2e
```

Expected: PASS 5-6 tests.

- [ ] **Step 3: 修复任何失败 (按实际情况调整 endpoint 路径 / DTO)**

- [ ] **Step 4: 提交**

```bash
git add apps/server/test/e2e/auth.e2e.spec.ts
git commit -m "test(e2e): 登录流 5 用例 (未登录/错密码/正确/受保护/过期/续签)"
```

---

## Task 7: E2E 流 2 — 授权流 (微信扫码 + ticket + token)

**Files:**
- Create: `apps/server/test/e2e/wechat-auth.e2e.spec.ts`

- [ ] **Step 1: 写测试**

```typescript
import nock from 'nock';
import { getE2EApp, closeE2EApp } from './helpers/e2e-app';
import { httpPost, makeToken } from './helpers/fixtures';
import { getPrisma, truncateAll } from '../helpers/prisma-test';
import { Factories } from '../helpers/factories';
import { WechatMock } from '../helpers/wechat-mock';

describe('E2E: 微信授权流', () => {
  beforeAll(async () => { await getE2EApp(); });
  afterAll(async () => { await closeE2EApp(); });
  beforeEach(async () => { await truncateAll(); nock.cleanAll(); });

  it('微信推送 verify_ticket → componentApp 持久化 (加密)', async () => {
    const res = await httpPost('/api/v1/webhook/wechat/component', {
      InfoType: 'component_verify_ticket',
      ComponentVerifyTicket: 'TICKET_FROM_WECHAT',
    });
    expect([200, 204]).toContain(res.status);
    const app = await getPrisma().componentApp.findFirst();
    expect(app).toBeTruthy();
    expect(app!.verifyTicket).toBeDefined();
    expect(app!.verifyTicket).not.toBe('TICKET_FROM_WECHAT'); // 已加密
  });
  it('运营人员请求 preauth code → 调微信 API', async () => {
    WechatMock.setupComponentToken();
    WechatMock.setupPreauthCode();
    const t = await Factories.tenant();
    const u = await Factories.user(t.id);
    const token = makeToken(u.id, t.id);
    const res = await httpPost('/api/v1/platform/preauth-codes', { componentAppId: 'compApp1' }, token);
    expect(res.body.data.preauth_code).toBe('mock_preauth');
  });
  it('公众号管理员扫码授权 → authorized 事件 → Authorizer 落库', async () => {
    WechatMock.setupComponentToken();
    WechatMock.setupQueryAuth();
    // 推 authorized 事件
    const res = await httpPost('/api/v1/webhook/wechat/component', {
      InfoType: 'authorized',
      AuthorizerAppid: 'wxmock123',
      AuthorizationCode: 'auth_code_xyz',
    });
    expect([200, 204]).toContain(res.status);
    const auth = await getPrisma().authorizer.findFirst({ where: { appId: 'wxmock123' } });
    expect(auth).toBeTruthy();
    expect(auth!.status).toBe('authorized');
  });
  it('微信 API 限频时 → 返回 20003 + 重试', async () => {
    nock('https://api.weixin.qq.com').post('/cgi-bin/component/api_component_token').reply(45009, { errcode: 45009, errmsg: 'freq limit' });
    const t = await Factories.tenant();
    const u = await Factories.user(t.id);
    const token = makeToken(u.id, t.id);
    const res = await httpPost('/api/v1/platform/component-token', { appId: 'compApp1' }, token);
    expect([20003, 429, 502]).toContain(res.body.code); // 业务错误或上游错误
  });
});
```

- [ ] **Step 2: 跑测试**

```bash
cd apps/server && pnpm test:e2e wechat-auth.e2e
```

- [ ] **Step 3: 修复路径/错误码不一致**

- [ ] **Step 4: 提交**

```bash
git add apps/server/test/e2e/wechat-auth.e2e.spec.ts
git commit -am "test(e2e): 微信授权流 4 用例 (ticket/preauth/authorized/限频)"
```

---

## Task 8: E2E 流 3 — 群发流

**Files:**
- Create: `apps/server/test/e2e/broadcast.e2e.spec.ts`

- [ ] **Step 1: 写测试**

```typescript
import nock from 'nock';
import { getE2EApp, closeE2EApp } from './helpers/e2e-app';
import { httpPost, makeToken } from './helpers/fixtures';
import { getPrisma, truncateAll } from '../helpers/prisma-test';
import { Factories } from '../helpers/factories';

describe('E2E: 群发流', () => {
  beforeAll(async () => { await getE2EApp(); });
  afterAll(async () => { await closeE2EApp(); });
  beforeEach(async () => { await truncateAll(); nock.cleanAll(); });

  it('选标签 → 预览 (命中粉丝数)', async () => {
    const t = await Factories.tenant();
    const a = await Factories.authorizer(t.id);
    const tag = await Factories.tag(t.id);
    for (let i = 0; i < 3; i++) {
      const f = await Factories.follower(t.id, a.id);
      await getPrisma().followerTagRelation.create({ data: { followerId: f.id, tagId: tag.id } });
    }
    const u = await Factories.user(t.id);
    const token = makeToken(u.id, t.id);
    const res = await httpPost(`/api/v1/messages/broadcast/preview`, {
      authorizerId: a.id, tagIds: [tag.id], type: 'text', content: 'hi',
    }, token);
    expect(res.status).toBe(200);
    expect(res.body.data.estimatedRecipients).toBe(3);
  });
  it('确认发送 → 写 broadcast_messages + 调微信 API (mock)', async () => {
    nock('https://api.weixin.qq.com').post('/cgi-bin/message/mass/sendall').reply(200, { errcode: 0, msg_id: 'mock_msg_1', msg_data_id: 'd1' });
    const t = await Factories.tenant();
    const a = await Factories.authorizer(t.id);
    const u = await Factories.user(t.id);
    const token = makeToken(u.id, t.id);
    const res = await httpPost('/api/v1/messages/broadcast', {
      authorizerId: a.id, type: 'text', content: 'hi', filter: { is_to_all: true },
    }, token);
    expect(res.status).toBe(200);
    const bms = await getPrisma().broadcastMessage.findMany();
    expect(bms.length).toBeGreaterThan(0);
    expect(bms[0].msgId).toBe('mock_msg_1');
  });
  it('微信返回 errcode != 0 → 业务错误 20001', async () => {
    nock('https://api.weixin.qq.com').post('/cgi-bin/message/mass/sendall').reply(200, { errcode: 40001, errmsg: 'invalid credential' });
    const t = await Factories.tenant();
    const a = await Factories.authorizer(t.id);
    const u = await Factories.user(t.id);
    const token = makeToken(u.id, t.id);
    const res = await httpPost('/api/v1/messages/broadcast', {
      authorizerId: a.id, type: 'text', content: 'hi', filter: { is_to_all: true },
    }, token);
    expect([20001, 502]).toContain(res.body.code);
  });
  it('权限不足 → 403 + 错误码 10003', async () => {
    const t = await Factories.tenant();
    const a = await Factories.authorizer(t.id);
    const u = await Factories.user(t.id);
    const token = makeToken(u.id, t.id, ['analyst']); // 角色不够
    const res = await httpPost('/api/v1/messages/broadcast', {
      authorizerId: a.id, type: 'text', content: 'hi', filter: { is_to_all: true },
    }, token);
    expect([403, 20003]).toContain(res.status);
    expect([10003, 10002]).toContain(res.body.code);
  });
});
```

- [ ] **Step 2: 跑测试**

```bash
cd apps/server && pnpm test:e2e broadcast.e2e
```

- [ ] **Step 3: 修复**

- [ ] **Step 4: 提交**

```bash
git add apps/server/test/e2e/broadcast.e2e.spec.ts
git commit -am "test(e2e): 群发流 4 用例 (预览/成功/微信错/无权限)"
```

---

## Task 9: CI E2E 跑通

**Files:**
- Modify: `.github/workflows/e2e.yml`

- [ ] **Step 1: 验证 e2e.yml 跑通**

PR → GitHub Actions → E2E job → 3 个 e2e 文件全绿。

- [ ] **Step 2: 加 e2e 到 main 分支的必须检查**

GitHub Settings → Branches → main → require E2E job status check。

- [ ] **Step 3: 提交 (如改 workflow)**

```bash
git commit -am "ci(e2e): main 分支强制 e2e 通过"
```

---

## Task 10: 完工验证 + 文档

- [ ] **Step 1: 全量跑测试**

```bash
cd apps/server
pnpm test           # 单测
pnpm test:e2e      # E2E
pnpm test:ci       # 单测 + 覆盖率
```

- [ ] **Step 2: 写 docs/architecture/README.md**

```markdown
# V2.0 架构清理总结

## 模块依赖

(嵌入 madge 生成的 graph.svg 图片)

## 抽象基类

- AbstractService: 所有业务 service 继承
- AbstractController: 控制器基类

## 抽象接口

- IStorageProvider: 存储 (MinIO / Local)
- IWechatClient: 微信客户端 (后续 task 拆分)

## E2E 关键流

- 登录流 (auth.e2e.spec.ts)
- 授权流 (wechat-auth.e2e.spec.ts)
- 群发流 (broadcast.e2e.spec.ts)

## 已知技术债

(列出 V1 遗留 + 未来 S2.5 任务)
```

- [ ] **Step 3: 提交**

```bash
git add docs/architecture/README.md
git commit -m "docs: V2.0 架构清理总结"
```

---

## 完工判定 (S6)

- [ ] `scripts/cycle-scan.sh` 0 循环
- [ ] IStorageProvider 抽象 + MinIO/Local 双实现
- [ ] 3 条 E2E 关键流全绿 (auth/wechat-auth/broadcast)
- [ ] `pnpm test:e2e` 在 CI 跑通
- [ ] docs/architecture/README.md 写好
- [ ] madge 报告嵌入 README

→ S6 完成, V2.0 全部完工!

---

## V2.0 完工总判定 (跨 6 sprint)

- [ ] 单测覆盖率 ≥ 60% (S1)
- [ ] DTO/Zod 100% (S2)
- [ ] 4 块 Grafana 看板 + 5 个告警 (S3)
- [ ] RBAC + 越权扫描 + 限流 + 审计 + secret scan + 漏洞 (S4)
- [ ] CI 完整 + 蓝绿部署 + 回滚演练成功 (S5)
- [ ] 模块无循环 + 3 E2E 关键流 (S6)
- [ ] 连续 2 周生产无 P0/P1
- [ ] Grafana 看板被团队日常使用

→ V2.0 完工. 决策 V2.1 方向 (AIGC vs CRM).
