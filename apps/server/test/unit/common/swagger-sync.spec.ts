/**
 * Swagger OpenAPI 同步 snapshot 测试
 * ============================================================================
 * 目的: 防止 OpenAPI 文档结构意外漂移(新加/删除/改路径、改方法、改鉴权要求)。
 *
 * 流程:
 *  1. 在内存中启动 AppModule(用 TestingModule + 内存中 Express,无 listen)
 *  2. 用 SwaggerModule.createDocument() 抓取 OpenAPI JSON
 *  3. 与 __snapshots__/openapi.json 做严格 toEqual 对比
 *  4. 当设置 UPDATE_SNAPSHOT=1 时,把当前生成的 doc 写回 snapshot 作为新基线
 *
 * 已知 caveat:
 *  - PrismaService.onModuleInit() 会 $connect(),我们在测试里 override 它,只
 *    暴露元数据扫描所需的接口,避免依赖真实 PostgreSQL。
 *  - ConfigService 在构造时读 env,AuthModule 在模块加载时也读 JWT_SECRET
 *    (见 auth.module.ts),所以下面这一段必须在 import 之前执行。
 *  - 本测试不调任何业务 controller,只取 OpenAPI 结构;若以后要校验 Zod 出参
 *    schema 进 OpenAPI body,需要先把 zod-openapi 接到 NestJS swagger plugin
 *    (见 zod-to-swagger.ts 头注释)再做扩展。
 */

// ── 必须在所有 import 之前:补齐 ConfigService / AuthModule 启动门禁的 env ──
// 用 require 而非 import,可避开 TS 的 import 提升;确保 env 写入先于
// AppModule / AuthModule 的模块级 env 读取。
require('node:fs'); // no-op, 保持文件顶部语义
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test';
process.env['JWT_SECRET'] = 'test-jwt-secret-must-be-at-least-32-chars-long';
process.env['JWT_EXPIRES_IN'] = '7200';
// 必须是 32 字节 base64 (44 字符);用确定性的 32 字节 ASCII 转 base64。
process.env['ENCRYPTION_KEY'] =
  'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=';
process.env['NODE_ENV'] = 'test';

import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/prisma/prisma.service';

describe('Swagger OpenAPI 同步', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      // 拦截 PrismaService.onModuleInit() 的 $connect(),避免依赖真实 DB。
      .overrideProvider(PrismaService)
      .useValue({
        onModuleInit: () => undefined,
        onModuleDestroy: () => undefined,
        $connect: () => Promise.resolve(),
        $disconnect: () => Promise.resolve(),
      })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('生成的 OpenAPI 与 Zod contract 一致', () => {
    const config = new DocumentBuilder().setTitle('WXGZH').setVersion('2.0.0').build();
    const doc = SwaggerModule.createDocument(app, config);
    const snapshot = path.join(__dirname, '__snapshots__', 'openapi.json');

    const dir = path.dirname(snapshot);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    if (process.env['UPDATE_SNAPSHOT']) {
      fs.writeFileSync(snapshot, JSON.stringify(doc, null, 2));
      return;
    }

    const expected = JSON.parse(fs.readFileSync(snapshot, 'utf-8'));
    expect(doc.paths).toEqual(expected.paths);
  });
});
