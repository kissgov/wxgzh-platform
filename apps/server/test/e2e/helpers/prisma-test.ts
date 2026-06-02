// test/e2e/helpers/prisma-test.ts
// Prisma 客户端 + truncate 工具: 每次 beforeEach 清表
import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
  if (!prisma) prisma = new PrismaClient();
  return prisma;
}

export async function truncateAll(): Promise<void> {
  const p = getPrisma();
  // 业务表清空 (按依赖倒序, FK 不会兜底)
  const tables = [
    'broadcastMessage',
    'followerTagRelation',
    'tag',
    'follower',
    'authorizer',
    'authEvent',
    'componentApp',
    'userRole',
    'rolePermission',
    'role',
    'permission',
    'user',
    'tenant',
  ];
  for (const t of tables) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (p as any)[t].deleteMany({});
    } catch {
      // 表不存在 (prisma generate 未跑) — 跳过
    }
  }
}

export async function closePrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = undefined;
  }
}
