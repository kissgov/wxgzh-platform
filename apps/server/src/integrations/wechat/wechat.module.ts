// 微信集成模块
// ============================================================================
// V2.0 S6: 注册 IWechatClient → WechatClientImpl 绑定, 业务模块可注入 WECHAT_CLIENT
import { Global, Module } from '@nestjs/common';
import { WechatService } from './wechat.service';
import { WechatCryptoService } from './wechat.crypto.service';
import { WechatWebhookController } from './wechat.webhook.controller';
import { WechatClientImpl } from './wechat.client.impl';
import { WECHAT_CLIENT } from './wechat.client.interface';

@Global()
@Module({
  controllers: [WechatWebhookController],
  providers: [
    WechatService,
    WechatCryptoService,
    WechatClientImpl,
    { provide: WECHAT_CLIENT, useExisting: WechatClientImpl },
  ],
  exports: [WechatService, WechatCryptoService, WECHAT_CLIENT],
})
export class WechatModule {}
