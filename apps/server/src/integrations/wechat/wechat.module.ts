// 微信集成模块
// ============================================================================
import { Global, Module } from '@nestjs/common';
import { WechatService } from './wechat.service';
import { WechatCryptoService } from './wechat.crypto.service';
import { WechatWebhookController } from './wechat.webhook.controller';

@Global()
@Module({
  controllers: [WechatWebhookController],
  providers: [WechatService, WechatCryptoService],
  exports: [WechatService, WechatCryptoService],
})
export class WechatModule {}
