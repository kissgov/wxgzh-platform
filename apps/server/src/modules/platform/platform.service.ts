// Platform Service — 第三方平台授权管理核心业务逻辑
// ============================================================================
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Redis } from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { WechatService } from '../../integrations/wechat/wechat.service';
import type { AuthorizerListQueryDto } from './platform.dto';

@Injectable()
export class PlatformService {
  private readonly logger = new Logger(PlatformService.name);
  private readonly redis: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly wechatService: WechatService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.redis = new Redis(process.env['REDIS_URL'] || 'redis://localhost:6379');
  }

  // ── ComponentApp 配置管理 ─────────────────────────────────────────────

  /** 获取 ComponentApp 配置（脱敏返回） */
  async getComponentAppConfig() {
    const app = await this.prisma.componentApp.findFirst({
      where: { status: 'active' },
    });
    if (!app) return null;

    return {
      id: app.id,
      appId: app.appId,
      appSecret: this.maskSecret(app.appSecret),
      token: app.token,
      encodingAesKey: this.maskSecret(app.encodingAesKey),
      hasVerifyTicket: !!app.verifyTicket,
      status: app.status,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
    };
  }

  /** 获取第一个活跃的 ComponentApp（内部使用，不脱敏） */
  async getActiveComponentApp() {
    return this.prisma.componentApp.findFirst({
      where: { status: 'active' },
    });
  }

  /** 创建或更新 ComponentApp 配置 */
  async upsertComponentApp(dto: {
    appId: string; appSecret: string; token: string; encodingAesKey: string;
  }) {
    const existing = await this.prisma.componentApp.findFirst({
      where: { status: 'active' },
    });

    if (existing) {
      const updated = await this.prisma.componentApp.update({
        where: { id: existing.id },
        data: {
          appId: dto.appId,
          appSecret: dto.appSecret,
          token: dto.token,
          encodingAesKey: dto.encodingAesKey,
        },
      });
      this.logger.log(`ComponentApp updated: ${dto.appId}`);
      return {
        id: updated.id, appId: updated.appId,
        appSecret: this.maskSecret(updated.appSecret),
        token: updated.token,
        encodingAesKey: this.maskSecret(updated.encodingAesKey),
        hasVerifyTicket: !!updated.verifyTicket,
        status: updated.status,
        createdAt: updated.createdAt, updatedAt: updated.updatedAt,
      };
    }

    const created = await this.prisma.componentApp.create({
      data: {
        appId: dto.appId, appSecret: dto.appSecret,
        token: dto.token, encodingAesKey: dto.encodingAesKey, status: 'active',
      },
    });
    this.logger.log(`ComponentApp created: ${dto.appId}`);
    return {
      id: created.id, appId: created.appId,
      appSecret: this.maskSecret(created.appSecret),
      token: created.token,
      encodingAesKey: this.maskSecret(created.encodingAesKey),
      hasVerifyTicket: false, status: created.status,
      createdAt: created.createdAt, updatedAt: created.updatedAt,
    };
  }

  private maskSecret(secret: string): string {
    if (secret.length <= 8) return '****';
    return secret.substring(0, 4) + '*'.repeat(Math.min(secret.length - 8, 20)) + secret.substring(secret.length - 4);
  }

  // ── 生成授权 URL ──────────────────────────────────────────────────────

  /**
   * 生成公众号授权二维码链接
   * 关键改进：存储 pre_auth_code ↔ tenantId 映射（Redis TTL=600s），
   * 微信回调时通过 pre_auth_code 反查租户
   */
  async generateAuthUrl(componentAppId: string, tenantId: string) {
    // 使用 WechatService 统一请求（走 Token 缓存 + 重试）
    const data = await this.wechatService.requestComponent<{
      pre_auth_code: string;
      expires_in: number;
    }>(
      componentAppId,
      'POST',
      '/cgi-bin/component/api_create_preauthcode',
      { component_appid: componentAppId },
    );

    const preAuthCode = data.pre_auth_code;

    // 存储 pre_auth_code → tenantId 映射（Redis，TTL = 600s 与微信一致）
    await this.redis.set(
      `preauth:${preAuthCode}`,
      tenantId,
      'EX',
      600,
    );

    // 生成授权 URL
    const authUrl = `https://mp.weixin.qq.com/cgi-bin/componentloginpage?component_appid=${componentAppId}&pre_auth_code=${preAuthCode}&redirect_uri=${encodeURIComponent('https://your-domain.com/auth/callback')}`;
    const qrCodeUrl = `https://mp.weixin.qq.com/cgi-bin/showqrcode?ticket=${encodeURIComponent(preAuthCode)}`;

    await this.prisma.authEvent.create({
      data: {
        componentAppId,
        eventType: 'preauth_created',
        processed: true,
      },
    });

    this.logger.log(`Auth URL generated for tenant=${tenantId}, pre_auth_code=${preAuthCode.substring(0, 10)}...`);
    return {
      pre_auth_code: preAuthCode,
      auth_url: authUrl,
      qr_code_url: qrCodeUrl,
      expires_in: data.expires_in,
    };
  }

  /**
   * 通过 pre_auth_code 反查租户 ID
   * 用于微信授权回调时确定授权归属
   */
  async resolveTenantFromPreAuthCode(preAuthCode: string): Promise<string | null> {
    const tenantId = await this.redis.get(`preauth:${preAuthCode}`);
    if (tenantId) {
      await this.redis.del(`preauth:${preAuthCode}`); // 用完即删
    }
    return tenantId;
  }

  // ── Ticket 处理 ──────────────────────────────────────────────────────

  /** 处理微信推送的 component_verify_ticket */
  async handleTicketReceived(componentAppId: string, ticket: string) {
    this.logger.log(`Ticket received for component appId=${componentAppId}`);

    // componentAppId here is the appId (wx...), not the internal ID.
    // Find the record by appId first, then use internal id for WechatService.
    const app = await this.prisma.componentApp.findUnique({
      where: { appId: componentAppId },
    });
    if (!app) {
      this.logger.error(`ComponentApp not found for appId: ${componentAppId}`);
      return;
    }

    await this.prisma.componentApp.update({
      where: { id: app.id },
      data: { verifyTicket: ticket },
    });

    // 使用 WechatService 刷新 component_access_token
    try {
      await this.wechatService.refreshComponentToken(app.id);
    } catch (err) {
      this.logger.error(`Failed to refresh component token on ticket: ${(err as Error).message}`);
    }

    this.eventEmitter.emit('platform.ticket.received', { componentAppId: app.id });
  }

  // ── 授权成功处理 ─────────────────────────────────────────────────────

  /** 处理授权成功回调：换取 Token + 同步基本信息 */
  async handleAuthorizationSucceeded(
    componentAppId: string,
    authCode: string,
    tenantId: string,
  ) {
    this.logger.log(`Authorization succeeded for component=${componentAppId}, tenant=${tenantId}`);

    // 1. 换取 authorizer_access_token + refresh_token（使用 WechatService 统一 API）
    const authData = await this.wechatService.requestComponent<{
      authorization_info: {
        authorizer_appid: string;
        authorizer_access_token: string;
        expires_in: number;
        authorizer_refresh_token: string;
        func_info: Array<{ funcscope_category: { id: number } }>;
      };
    }>(
      componentAppId,
      'POST',
      '/cgi-bin/component/api_query_auth',
      { component_appid: componentAppId, authorization_code: authCode },
    );

    const authInfo = authData.authorization_info;
    const authorizerAppId = authInfo.authorizer_appid;

    // 2. 获取授权方基本信息
    const infoData = await this.wechatService.requestComponent<{
      authorizer_info: {
        nick_name: string;
        head_img: string;
        service_type_info: { id: number };
        verify_type_info: { id: number };
        user_name: string;
        principal_name: string;
        qrcode_url: string;
        signature: string;
      };
    }>(
      componentAppId,
      'POST',
      '/cgi-bin/component/api_get_authorizer_info',
      { component_appid: componentAppId, authorizer_appid: authorizerAppId },
    );

    const info = infoData.authorizer_info;

    // 3. 查找 ComponentApp 内部 ID
    const componentApp = await this.prisma.componentApp.findUnique({
      where: { appId: componentAppId },
    });
    if (!componentApp) throw new Error(`ComponentApp not found: ${componentAppId}`);

    // 4. UPSERT Authorizer
    const authorizer = await this.prisma.authorizer.upsert({
      where: { appId: authorizerAppId },
      create: {
        tenantId,
        componentAppId: componentApp.id,
        appId: authorizerAppId,
        appType: info.service_type_info.id,
        nickName: info.nick_name,
        headImg: info.head_img,
        qrcodeUrl: info.qrcode_url,
        principalName: info.principal_name,
        signature: info.signature,
        accessToken: authInfo.authorizer_access_token,
        refreshToken: authInfo.authorizer_refresh_token,
        tokenExpireAt: new Date(Date.now() + authInfo.expires_in * 1000),
        funcInfo: authInfo.func_info as any,
        status: 'authorized',
        authorizedAt: new Date(),
        lastSyncAt: new Date(),
      },
      update: {
        tenantId,
        componentAppId: componentApp.id,
        appType: info.service_type_info.id,
        nickName: info.nick_name,
        headImg: info.head_img,
        qrcodeUrl: info.qrcode_url,
        principalName: info.principal_name,
        signature: info.signature,
        accessToken: authInfo.authorizer_access_token,
        refreshToken: authInfo.authorizer_refresh_token,
        tokenExpireAt: new Date(Date.now() + authInfo.expires_in * 1000),
        funcInfo: authInfo.func_info as any,
        status: 'authorized',
        lastSyncAt: new Date(),
        deletedAt: null,
      },
    });

    // 5. 发布事件
    this.eventEmitter.emit('authorizer.created', {
      authorizerId: authorizer.id, tenantId, appId: authorizerAppId,
    });

    this.logger.log(`Authorizer created/updated: ${authorizer.nickName} (${authorizerAppId})`);
    return authorizer;
  }

  // ── 授权取消处理 ─────────────────────────────────────────────────────

  /** 处理授权取消/回收 */
  async handleAuthorizationRevoked(appId: string) {
    this.logger.log(`Authorization revoked for ${appId}`);
    const authorizer = await this.prisma.authorizer.findUnique({ where: { appId } });
    if (!authorizer) {
      this.logger.warn(`Authorizer not found for appId=${appId}`);
      return;
    }
    await this.prisma.authorizer.update({
      where: { id: authorizer.id },
      data: { status: 'revoked' },
    });
    this.eventEmitter.emit('authorizer.revoked', { authorizerId: authorizer.id, appId });
  }

  // ── 查询 ─────────────────────────────────────────────────────────────

  async getAuthorizers(tenantId: string, query: AuthorizerListQueryDto) {
    const { page = 1, page_size = 20, keyword, status, sort = 'authorizedAt', order = 'desc' } = query;
    const where: Record<string, unknown> = { tenantId, deletedAt: null };
    if (status) where['status'] = status;
    if (keyword) {
      where['OR'] = [
        { nickName: { contains: keyword } },
        { appId: { contains: keyword } },
        { principalName: { contains: keyword } },
      ];
    }

    const [list, total] = await Promise.all([
      this.prisma.authorizer.findMany({
        where: where as any,
        orderBy: { [sort]: order },
        skip: (page - 1) * page_size,
        take: page_size,
      }),
      this.prisma.authorizer.count({ where: where as any }),
    ]);

    const safeList = list.map((a: any) => ({
      id: a.id, appId: a.appId, appType: a.appType,
      nickName: a.nickName, headImg: a.headImg,
      qrcodeUrl: a.qrcodeUrl, principalName: a.principalName,
      funcInfo: a.funcInfo, status: a.status,
      authorizedAt: a.authorizedAt, expiredAt: a.expiredAt,
      lastSyncAt: a.lastSyncAt, createdAt: a.createdAt,
    }));

    return { list: safeList, total, page, page_size };
  }

  async getAuthorizerDetail(tenantId: string, authorizerId: string) {
    const authorizer = await this.prisma.authorizer.findFirst({
      where: { id: authorizerId, tenantId, deletedAt: null },
    });
    if (!authorizer) throw new NotFoundException('授权公众号不存在');
    const { accessToken, refreshToken, ...safe } = authorizer;
    return safe;
  }

  // ── 同步 ─────────────────────────────────────────────────────────────

  async syncAuthorizerInfo(tenantId: string, authorizerId: string) {
    const authorizer = await this.prisma.authorizer.findFirst({
      where: { id: authorizerId, tenantId, deletedAt: null },
    });
    if (!authorizer) throw new NotFoundException('授权公众号不存在');

    // 使用 WechatService 统一请求
    const infoData = await this.wechatService.requestComponent<{
      authorizer_info: {
        nick_name: string;
        head_img: string;
        service_type_info: { id: number };
        principal_name: string;
        qrcode_url: string;
        signature: string;
      };
    }>(
      authorizer.componentAppId,
      'POST',
      '/cgi-bin/component/api_get_authorizer_info',
      {
        component_appid: authorizer.componentAppId,
        authorizer_appid: authorizer.appId,
      },
    );

    const info = infoData.authorizer_info;
    const updated = await this.prisma.authorizer.update({
      where: { id: authorizerId },
      data: {
        nickName: info.nick_name,
        headImg: info.head_img,
        qrcodeUrl: info.qrcode_url,
        principalName: info.principal_name,
        signature: info.signature,
        appType: info.service_type_info.id,
        lastSyncAt: new Date(),
      },
    });

    this.logger.log(`Authorizer synced: ${authorizerId}`);
    const { accessToken, refreshToken, ...safe } = updated;
    return safe;
  }

  // ── 回收 ─────────────────────────────────────────────────────────────

  async revokeAuthorizer(tenantId: string, authorizerId: string, userId: string) {
    const authorizer = await this.prisma.authorizer.findFirst({
      where: { id: authorizerId, tenantId, deletedAt: null },
    });
    if (!authorizer) throw new NotFoundException('授权公众号不存在');

    await this.prisma.authorizer.update({
      where: { id: authorizerId },
      data: { status: 'revoked' },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId, userId,
        action: 'platform.revoke',
        resource: 'authorizer',
        resourceId: authorizerId,
        detail: { appId: authorizer.appId, nickName: authorizer.nickName } as any,
      },
    });

    this.eventEmitter.emit('authorizer.revoked', {
      authorizerId, appId: authorizer.appId,
    });
    this.logger.log(`Authorizer revoked: ${authorizerId} by user=${userId}`);
    return { status: 'revoked', revokedAt: new Date() };
  }
}
