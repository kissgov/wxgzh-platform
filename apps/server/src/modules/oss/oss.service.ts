// OSS Service — MinIO / S3-Compatible 对象存储
// ============================================================================
import { Injectable, Logger } from '@nestjs/common';
import * as Minio from 'minio';

@Injectable()
export class OssService {
  private readonly logger = new Logger(OssService.name);
  private readonly client: Minio.Client;
  private readonly bucket: string;

  constructor() {
    this.bucket = process.env['OSS_BUCKET'] || 'wxgzh-materials';
    this.client = new Minio.Client({
      endPoint: process.env['OSS_ENDPOINT'] || 'localhost',
      port: parseInt(process.env['OSS_PORT'] || '9000', 10),
      useSSL: process.env['OSS_USE_SSL'] === 'true',
      accessKey: process.env['OSS_ACCESS_KEY'] || 'minioadmin',
      secretKey: process.env['OSS_SECRET_KEY'] || 'minioadmin',
    });
  }

  /**
   * 上传文件到 MinIO
   * @returns 文件访问 URL
   */
  async upload(
    objectName: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    // 确保 bucket 存在
    const exists = await this.client.bucketExists(this.bucket);
    if (!exists) {
      await this.client.makeBucket(this.bucket);
      this.logger.log(`Bucket created: ${this.bucket}`);
    }

    await this.client.putObject(this.bucket, objectName, buffer, buffer.length, {
      'Content-Type': contentType,
    });

    const url = await this.getUrl(objectName);
    this.logger.log(`File uploaded: ${objectName} (${(buffer.length / 1024).toFixed(0)} KB)`);
    return url;
  }

  /** 获取文件公开访问 URL */
  async getUrl(objectName: string): Promise<string> {
    const useSSL = process.env['OSS_USE_SSL'] === 'true';
    const endpoint = process.env['OSS_ENDPOINT'] || 'localhost';
    const port = process.env['OSS_PORT'] || '9000';
    const protocol = useSSL ? 'https' : 'http';
    return `${protocol}://${endpoint}:${port}/${this.bucket}/${objectName}`;
  }

  /** 删除文件 */
  async delete(objectName: string): Promise<void> {
    await this.client.removeObject(this.bucket, objectName);
  }
}
