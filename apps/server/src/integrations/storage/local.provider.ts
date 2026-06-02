// apps/server/src/integrations/storage/local.provider.ts
// 本地 FS 实现 (开发/测试): 写文件到 LOCAL_STORAGE_DIR, signed URL 走 HMAC token
import { Injectable } from '@nestjs/common';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Readable } from 'node:stream';
import {
  GetSignedUrlInput,
  IStorageProvider,
  PutObjectInput,
  PutObjectResult,
} from './storage.interface';

@Injectable()
export class LocalStorageProvider implements IStorageProvider {
  private readonly root: string;
  private readonly tokenSecret: string;

  constructor() {
    this.root = process.env['LOCAL_STORAGE_DIR'] || '/tmp/wxgzh-storage';
    this.tokenSecret = process.env['LOCAL_STORAGE_TOKEN'] || 'dev-local-secret';
  }

  async put(input: PutObjectInput): Promise<PutObjectResult> {
    const full = path.join(this.root, input.key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    const body = Buffer.isBuffer(input.body)
      ? input.body
      : await this.streamToBuffer(input.body as Readable);
    await fs.writeFile(full, body);
    return { key: input.key, url: `file://${full}` };
  }

  async getSignedUrl(input: GetSignedUrlInput): Promise<string> {
    const token = crypto
      .createHmac('sha256', this.tokenSecret)
      .update(input.key + input.expiresInSec)
      .digest('hex');
    return `/api/v1/local-storage/${encodeURIComponent(input.key)}?t=${input.expiresInSec}&s=${token}`;
  }

  async delete(key: string): Promise<void> {
    await fs.unlink(path.join(this.root, key)).catch(() => undefined);
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(path.join(this.root, key));
      return true;
    } catch {
      return false;
    }
  }

  private async streamToBuffer(s: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const c of s) chunks.push(Buffer.from(c as Uint8Array));
    return Buffer.concat(chunks);
  }
}
