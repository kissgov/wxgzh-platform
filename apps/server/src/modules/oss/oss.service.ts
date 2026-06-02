// OSS Service — 通过 IStorageProvider 抽象访问对象存储
// ============================================================================
// V2.0 S6: 业务层只依赖 IStorageProvider 接口, 不直接 import MinIO SDK
// 切换驱动: STORAGE_DRIVER=minio | local (默认 local, 生产改 minio)
import { Inject, Injectable } from '@nestjs/common';
import { IStorageProvider, STORAGE_PROVIDER } from '../../integrations/storage/storage.interface';

@Injectable()
export class OssService {
  constructor(@Inject(STORAGE_PROVIDER) private readonly storage: IStorageProvider) {}

  /**
   * 上传文件, 返回访问 URL (兼容 V1 调用方: OssService.upload(key, buf, type): Promise<string>)
   */
  async upload(key: string, body: Buffer, contentType: string): Promise<string> {
    const res = await this.storage.put({ key, body, contentType });
    return res.url;
  }

  /** 获取签名 URL (默认 1 小时) */
  async getUrl(key: string, expiresInSec: number = 3600): Promise<string> {
    return this.storage.getSignedUrl({ key, expiresInSec });
  }

  /** 删除文件 */
  async delete(key: string): Promise<void> {
    return this.storage.delete(key);
  }

  /** 文件存在性 */
  async exists(key: string): Promise<boolean> {
    return this.storage.exists(key);
  }
}
