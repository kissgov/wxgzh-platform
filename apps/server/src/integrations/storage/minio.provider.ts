// apps/server/src/integrations/storage/minio.provider.ts
// MinIO / S3 兼容实现 (用 V1 已有的 minio SDK, 不引入新依赖)
import { Injectable, Logger } from '@nestjs/common';
import { Readable } from 'node:stream';
import * as Minio from 'minio';
import {
  GetSignedUrlInput,
  IStorageProvider,
  PutObjectInput,
  PutObjectResult,
} from './storage.interface';

@Injectable()
export class MinioStorageProvider implements IStorageProvider {
  private readonly logger = new Logger(MinioStorageProvider.name);
  private readonly client: Minio.Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor() {
    this.bucket = process.env['OSS_BUCKET'] || 'wxgzh-materials';
    this.client = new Minio.Client({
      endPoint: process.env['OSS_ENDPOINT'] || 'localhost',
      port: parseInt(process.env['OSS_PORT'] || '9000', 10),
      useSSL: process.env['OSS_USE_SSL'] === 'true',
      accessKey: process.env['OSS_ACCESS_KEY'] || 'minioadmin',
      secretKey: process.env['OSS_SECRET_KEY'] || 'minioadmin',
    });
    const useSSL = process.env['OSS_USE_SSL'] === 'true';
    const endpoint = process.env['OSS_ENDPOINT'] || 'localhost';
    const port = process.env['OSS_PORT'] || '9000';
    const protocol = useSSL ? 'https' : 'http';
    this.publicBaseUrl = `${protocol}://${endpoint}:${port}/${this.bucket}`;
  }

  async put(input: PutObjectInput): Promise<PutObjectResult> {
    if (!(await this.client.bucketExists(this.bucket))) {
      await this.client.makeBucket(this.bucket);
      this.logger.log(`Bucket created: ${this.bucket}`);
    }
    const meta: Record<string, string> = { ...(input.metadata || {}) };
    if (input.contentType) meta['Content-Type'] = input.contentType;
    const size = Buffer.isBuffer(input.body) ? input.body.length : undefined;
    const stream = Buffer.isBuffer(input.body) ? input.body : (input.body as Readable);
    await this.client.putObject(this.bucket, input.key, stream as any, size, meta);
    return {
      key: input.key,
      url: `${this.publicBaseUrl}/${input.key}`,
    };
  }

  async getSignedUrl(input: GetSignedUrlInput): Promise<string> {
    return this.client.presignedGetObject(this.bucket, input.key, input.expiresInSec);
  }

  async delete(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key);
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucket, key);
      return true;
    } catch {
      return false;
    }
  }
}
