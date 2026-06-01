// Platform Module — 第三方平台授权管理
// ============================================================================
import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { PlatformEventHandler } from './platform.event-handler';

@Module({
  controllers: [PlatformController],
  providers: [PlatformService, PlatformEventHandler],
  exports: [PlatformService],
})
export class PlatformModule {}
