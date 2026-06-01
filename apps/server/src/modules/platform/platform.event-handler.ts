// Platform Event Handler — 处理微信回调事件
// ============================================================================
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformService } from './platform.service';
import { WechatEvents } from '../../integrations/wechat/wechat.events';
import * as xml2js from 'xml2js';

interface WechatEventPayload {
  xml: string;
  componentAppId: string;
  componentAppid: string;
  authEventId: string;
  eventType: string;
}

@Injectable()
export class PlatformEventHandler implements OnModuleInit {
  private readonly logger = new Logger(PlatformEventHandler.name);
  private parser!: xml2js.Parser;

  constructor(
    private readonly prisma: PrismaService,
    private readonly platformService: PlatformService,
  ) {}

  onModuleInit() {
    this.parser = new xml2js.Parser({ explicitArray: false, trim: true });
    this.logger.log('PlatformEventHandler initialized');
  }

  /**
   * 接收微信事件推送并分发处理
   */
  @OnEvent(WechatEvents.EVENT_RECEIVED, { async: true })
  async handleWechatEvent(payload: WechatEventPayload) {
    const { xml, componentAppId, authEventId, componentAppid } = payload;

    try {
      const parsed: Record<string, any> = await this.parser.parseStringPromise(xml);
      const event = parsed['xml'];

      if (!event) {
        this.logger.warn('Empty xml event');
        return;
      }

      const infoType = event['InfoType'] as string;
      this.logger.log(`Processing wechat event: InfoType=${infoType}`);

      // 更新事件日志
      await this.prisma.authEvent.update({
        where: { id: authEventId },
        data: { eventType: infoType || 'unknown', processed: false },
      });

      switch (infoType) {
        case 'component_verify_ticket': {
          const ticket = event['ComponentVerifyTicket'] as string;
          if (ticket) {
            // componentAppid is the appId string (wx...); handleTicketReceived handles the conversion
            await this.platformService.handleTicketReceived(componentAppid, ticket);
          }
          break;
        }

        case 'authorized':
        case 'updateauthorized': {
          const authCode = event['AuthorizationCode'] as string;
          const preAuthCode = event['PreAuthCode'] as string;

          if (authCode) {
            // 通过 pre_auth_code 反查 tenantId（Redis 映射）
            let tenantId = 'default';
            if (preAuthCode) {
              const resolved = await this.platformService.resolveTenantFromPreAuthCode(preAuthCode);
              if (resolved) {
                tenantId = resolved;
              } else {
                this.logger.warn(`Cannot resolve tenant for pre_auth_code: ${preAuthCode.substring(0, 10)}..., using default`);
              }
            }

            const authorizer = await this.platformService.handleAuthorizationSucceeded(
              componentAppid,
              authCode,
              tenantId,
            );

            await this.prisma.authEvent.update({
              where: { id: authEventId },
              data: { authorizerId: authorizer.id, processed: true },
            });
          }
          break;
        }

        case 'unauthorized': {
          const authorizerAppId = event['AuthorizerAppid'] as string;
          if (authorizerAppId) {
            await this.platformService.handleAuthorizationRevoked(authorizerAppId);
          }
          // 标记事件已处理
          await this.prisma.authEvent.update({
            where: { id: authEventId },
            data: { processed: true },
          });
          break;
        }

        default:
          this.logger.debug(`Unhandled InfoType: ${infoType}, forwarding to message handler`);
          break;
      }
    } catch (err) {
      this.logger.error(`Failed to process wechat event: ${(err as Error).message}`);

      await this.prisma.authEvent.update({
        where: { id: authEventId },
        data: {
          processed: false,
          errorMessage: (err as Error).message,
        },
      });
    }
  }
}
