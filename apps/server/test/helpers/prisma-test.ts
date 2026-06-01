// Test DB lifecycle helpers (testcontainer-based)
// ============================================================================
// 启动 PostgreSQL 16 容器、运行 prisma migrate deploy、提供 PrismaClient。
// 用于集成测试 (Task 7+); 单元测试不需要调用。
// ============================================================================
import { PrismaClient } from '@prisma/client';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { execSync } from 'node:child_process';
import * as path from 'node:path';

// Prisma schema 在 monorepo 根目录 /prisma/schema.prisma; 本文件位于
// apps/server/test/helpers/, 所以向上 4 层。
const SCHEMA_PATH = path.resolve(__dirname, '../../../../prisma/schema.prisma');

let container: StartedPostgreSqlContainer | undefined;
let prisma: PrismaClient | undefined;

/**
 * 启动测试数据库 (testcontainer + migrate)。多次调用复用同一实例。
 * 调用方应在 beforeAll() 里调用。
 */
export async function setupTestDb(): Promise<PrismaClient> {
  if (prisma) return prisma;

  container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('wxgzh_test')
    .withUsername('test')
    .withPassword('test')
    .start();

  const url = `${container.getConnectionUri()}?schema=public`;
  process.env.DATABASE_URL = url;

  execSync(`npx prisma migrate deploy --schema="${SCHEMA_PATH}"`, {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });

  prisma = new PrismaClient({ datasourceUrl: url });
  await prisma.$connect();
  return prisma;
}

/**
 * 关闭 Prisma 连接并销毁容器。调用方应在 afterAll() 里调用。
 */
export async function teardownTestDb(): Promise<void> {
  await prisma?.$disconnect();
  prisma = undefined;
  await container?.stop();
  container = undefined;
}

/**
 * 清空所有业务表 (保留 _prisma_migrations)。多个测试间互相隔离时调用。
 */
export async function truncateAll(): Promise<void> {
  if (!prisma) throw new Error('truncateAll() called before setupTestDb()');
  const rows = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT LIKE '_prisma%'
  `;
  if (rows.length === 0) return;
  const tables = rows.map((r: { tablename: string }) => `"${r.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
}

/**
 * 获取当前 PrismaClient (testcontainer 已初始化后)。
 */
export function getPrisma(): PrismaClient {
  if (!prisma) {
    throw new Error('Prisma not initialized; call setupTestDb() in beforeAll first');
  }
  return prisma;
}
