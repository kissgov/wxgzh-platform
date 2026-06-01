// 微信事件接收 URL Controller
// ============================================================================
import {
  Controller, Get, Post, Query, Body, Param, Res, Logger,
  HttpStatus, HttpException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WechatCryptoService } from './wechat.crypto.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Public } from '../../common/decorators/current-user.decorator';
import { WechatEvents } from './wechat.events';

@ApiTags('微信回调')
@Controller('webhook/wechat')
export class WechatWebhookController {
  private readonly logger = new Logger(WechatWebhookController.name);

  constructor(
    private readonly cryptoService: WechatCryptoService,
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * 微信服务器验证（GET 请求）
   * 微信会发送 GET 请求验证服务器有效性，需返回 echostr
   */
  @Public()
  @Get(':componentAppId')
  @ApiOperation({ summary: '微信服务器验证' })
  async verifyServer(
    @Param('componentAppId') componentAppId: string,
    @Query('signature') signature: string,
    @Query('timestamp') timestamp: string,
    @Query('nonce') nonce: string,
    @Query('echostr') echostr: string,
  ): Promise<string> {
    const app = await this.prisma.componentApp.findUnique({
      where: { appId: componentAppId },
    });
    if (!app) return 'error';

    // 验证签名
    const isValid = this.cryptoService.verifySignature(
      app.token, timestamp, nonce, echostr, signature,
    );
    if (!isValid) {
      this.logger.warn(`Server verify: signature mismatch for ${componentAppId}`);
      return 'error';
    }

    // 解密 echostr 并返回（微信验证流程）
    try {
      const decrypted = this.cryptoService.decrypt(app.encodingAesKey, echostr);
      this.logger.log(`Server verified for component: ${componentAppId}`);
      return decrypted;
    } catch (err) {
      this.logger.error(`Verify failed: ${(err as Error).message}`);
      return 'error';
    }
  }

  /**
   * 接收微信事件推送（POST 请求）
   * 必须在 5 秒内返回 "success"
   */
  @Public()
  @Post(':componentAppId')
  @ApiOperation({ summary: '接收微信事件推送' })
  async receiveEvent(
    @Param('componentAppId') componentAppId: string,
    @Query('signature') signature: string,
    @Query('timestamp') timestamp: string,
    @Query('nonce') nonce: string,
    @Body() body: { Encrypt: string; ToUserName: string },
    @Res() res: Response,
  ): Promise<void> {
    // 0. 查询 component_app 并校验签名
    const app = await this.prisma.componentApp.findUnique({
      where: { appId: componentAppId },
    });
    if (!app) {
      res.status(HttpStatus.NOT_FOUND).send('error');
      return;
    }

    if (!body.Encrypt) {
      res.status(HttpStatus.BAD_REQUEST).send('missing encrypt body');
      return;
    }

    const isValid = this.cryptoService.verifySignature(
      app.token, timestamp, nonce, body.Encrypt, signature,
    );
    if (!isValid) {
      this.logger.warn(`Webhook signature verification FAILED for ${componentAppId}`);
      res.status(HttpStatus.FORBIDDEN).send('signature mismatch');
      return;
    }

    // 1. 立即返回 success（微信要求 5s 内响应）
    res.status(200).send('success');

    // 2. 异步处理事件
    try {
      // 解密消息
      const xml = this.cryptoService.decrypt(app.encodingAesKey, body.Encrypt);

      // 从 XML 中简单提取事件类型
      const eventType = this.extractEventType(xml);

      // 存储事件日志
      const authEvent = await this.prisma.authEvent.create({
        data: {
          componentAppId: app.id,
          eventType,
          rawXml: xml,
          processed: true,
        },
      });

      // 分发到 EventEmitter（由各模块订阅处理）
      this.eventEmitter.emit(WechatEvents.EVENT_RECEIVED, {
        xml,
        componentAppId: app.id,
        componentAppid: app.appId,
        authEventId: authEvent.id,
        eventType,
      });

      this.logger.log(`Wechat event received: ${eventType} for ${componentAppId}`);
    } catch (err) {
      const errorMessage = (err as Error).message;
      this.logger.error(`Failed to process wechat event: ${errorMessage}`);

      // 记录失败事件供排查
      try {
        await this.prisma.authEvent.create({
          data: {
            componentAppId: app.id,
            eventType: 'processing_error',
            rawXml: body.Encrypt?.substring(0, 500),
            processed: false,
            errorMessage,
          },
        });
      } catch {
        // 连日志也写不了就放弃
      }
    }
  }

  /** 从 XML 中提取事件类型（InfoType 或 MsgType） */
  private extractEventType(xml: string): string {
    // 简单正则提取，避免引入 XML 解析器
    const infoMatch = xml.match(/<InfoType><!\[CDATA\[(.+?)\]\]><\/InfoType>/);
    if (infoMatch?.[1]) return infoMatch[1]; // component_verify_ticket / authorized / ...

    const msgMatch = xml.match(/<MsgType><!\[CDATA\[(.+?)\]\]><\/MsgType>/);
    if (msgMatch?.[1]) return msgMatch[1]; // text / image / event / ...

    const eventMatch = xml.match(/<Event><!\[CDATA\[(.+?)\]\]><\/Event>/);
    if (eventMatch?.[1]) return eventMatch[1]; // subscribe / unsubscribe / CLICK / ...

    return 'unknown';
  }
}
