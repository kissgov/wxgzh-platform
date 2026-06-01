// OSS Module — 对象存储
// ============================================================================
import { Global, Module } from '@nestjs/common';
import { OssService } from './oss.service';

@Global()
@Module({
  providers: [OssService],
  exports: [OssService],
})
export class OssModule {}
