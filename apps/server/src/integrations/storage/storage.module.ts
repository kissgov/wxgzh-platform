// apps/server/src/integrations/storage/storage.module.ts
// 注册 STORAGE_PROVIDER, 按 STORAGE_DRIVER env 切换实现
import { Global, Module } from '@nestjs/common';
import { STORAGE_PROVIDER } from './storage.interface';
import { LocalStorageProvider } from './local.provider';
import { MinioStorageProvider } from './minio.provider';

@Global()
@Module({
  providers: [
    LocalStorageProvider,
    MinioStorageProvider,
    {
      provide: STORAGE_PROVIDER,
      useClass: process.env['STORAGE_DRIVER'] === 'minio' ? MinioStorageProvider : LocalStorageProvider,
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
