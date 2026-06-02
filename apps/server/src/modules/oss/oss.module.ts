// OSS Module — 对象存储
// ============================================================================
// V2.0 S6: StorageModule 提供 STORAGE_PROVIDER, OssService 只做薄包装
import { Global, Module } from '@nestjs/common';
import { StorageModule } from '../../integrations/storage/storage.module';
import { OssService } from './oss.service';

@Global()
@Module({
  imports: [StorageModule],
  providers: [OssService],
  exports: [OssService, StorageModule],
})
export class OssModule {}
