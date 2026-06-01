// Prisma Service — 数据库访问层 + 字段级加密 + 租户上下文
// ============================================================================
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

// ── 字段级 AES-256-GCM 加密 ─────────────────────────────────────────────

const SENSITIVE_FIELDS = {
  ComponentApp: ['appSecret', 'encodingAesKey', 'verifyTicket', 'accessToken'],
  Authorizer: ['accessToken', 'refreshToken'],
} as const;

function getEncryptionKey(): Buffer {
  const key = process.env['ENCRYPTION_KEY'];
  if (!key) throw new Error('ENCRYPTION_KEY is required for field encryption');
  return Buffer.from(key, 'base64'); // 32 bytes
}

function encryptField(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // GCM 推荐 12 字节 IV
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // 格式: iv(12) + tag(16) + ciphertext → base64
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decryptField(encoded: string): string {
  const key = getEncryptionKey();
  const buf = Buffer.from(encoded, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

function isEncrypted(value: string): boolean {
  // 尝试 base64 解码检查长度（加密后 > 28 字节）
  try {
    return Buffer.from(value, 'base64').length > 28;
  } catch {
    return false;
  }
}

// ── PrismaService ────────────────────────────────────────────────────────

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log:
        process.env['NODE_ENV'] === 'development'
          ? ['warn', 'error']
          : ['error'],
    });

    // 注册字段级加密中间件（使用 Prisma 中间件 API）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.$use(async (params: any, next: any) => {
      const model = params.model as string;
      const action = params.action as string;
      const fields = SENSITIVE_FIELDS[model as keyof typeof SENSITIVE_FIELDS];

      if (fields && params.args?.data) {
        // ── 写入前加密 ──
        if (['create', 'createMany', 'update', 'updateMany', 'upsert'].includes(action)) {
          const data = action === 'upsert' ? params.args.data : params.args.data;
          this.encryptFields(data, fields);
        }
      }

      const result = await next(params);

      // ── 读取后解密 ──
      if (fields && result && ['findUnique', 'findFirst', 'findMany', 'create', 'update'].includes(action)) {
        const items = Array.isArray(result) ? result : [result];
        for (const item of items) {
          if (!item) continue;
          for (const field of fields) {
            if (item[field] && isEncrypted(item[field])) {
              try {
                item[field] = decryptField(item[field]);
              } catch {
                // 解密失败保留原值（可能不是加密数据）
              }
            }
          }
        }
      }

      return result;
    });
  }

  private encryptFields(data: any, fields: readonly string[]): void {
    for (const field of fields) {
      if (data[field] && typeof data[field] === 'string') {
        data[field] = encryptField(data[field]);
      }
    }
    // 处理嵌套数据（如 create/update 的嵌套写入）
    if (data.data) this.encryptFields(data.data, fields);
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
