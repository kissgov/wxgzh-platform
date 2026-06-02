// apps/server/src/integrations/storage/storage.interface.ts
// 存储抽象: 上传/签名URL/删除/存在性
// V2.0 S6: 业务模块只引 IStorageProvider, 不直接依赖 MinIO SDK
import { Readable } from 'node:stream';

export interface PutObjectInput {
  key: string;
  body: Buffer | Readable;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface PutObjectResult {
  key: string;
  url: string;
  etag?: string;
}

export interface GetSignedUrlInput {
  key: string;
  expiresInSec: number;
}

export interface IStorageProvider {
  put(input: PutObjectInput): Promise<PutObjectResult>;
  getSignedUrl(input: GetSignedUrlInput): Promise<string>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');
