// apps/server/src/integrations/wechat/wechat.client.impl.ts
// IWechatClient 的早期实现: 委托给现有 WechatService.request/requestComponent
// V2.0 S6 范围: 仅占位, 后续 task 把 wechat.service.ts 拆分为 IWechatClient 实现
import { Injectable, Logger } from '@nestjs/common';
import { WechatService } from './wechat.service';
import { IWechatClient } from './wechat.client.interface';

@Injectable()
export class WechatClientImpl implements IWechatClient {
  private readonly logger = new Logger(WechatClientImpl.name);

  constructor(private readonly wechat: WechatService) {}

  async getAuthorizerToken(authorizerAppId: string): Promise<string> {
    return this.wechat.getAuthorizerToken(authorizerAppId);
  }

  async sendBroadcast(
    authorizerAppId: string,
    payload: unknown,
  ): Promise<{ msgId: string; msgDataId?: string }> {
    const res = await this.wechat.request<{ msg_id: string; msg_data_id?: string }>(
      authorizerAppId,
      'POST',
      '/cgi-bin/message/mass/sendall',
      payload,
    );
    return { msgId: res.msg_id, msgDataId: res.msg_data_id };
  }

  async getUserList(
    authorizerAppId: string,
    nextOpenId?: string,
  ): Promise<{ openids: string[]; total: number; nextOpenId?: string }> {
    const res = await this.wechat.getFollowers(authorizerAppId, nextOpenId);
    return {
      openids: res.data?.openid ?? [],
      total: res.total,
      nextOpenId: res.next_openid,
    };
  }

  async getUserInfo(authorizerAppId: string, openid: string): Promise<unknown> {
    return this.wechat.request(authorizerAppId, 'GET', '/cgi-bin/user/info', { openid });
  }

  async createMenu(authorizerAppId: string, menu: unknown): Promise<void> {
    await this.wechat.request(authorizerAppId, 'POST', '/cgi-bin/menu/create', menu);
  }

  async uploadMedia(
    authorizerAppId: string,
    type: 'image' | 'video' | 'voice' | 'thumb',
    body: Buffer,
    _filename: string,
  ): Promise<{ mediaId: string; url: string }> {
    // 二进制上传走 multipart/form-data, 由 wechat.service 后续拆分
    this.logger.warn(`uploadMedia(${type}) 暂未拆分到 impl, 走 wechat.service`);
    const res = await this.wechat.request<{ media_id: string; url: string }>(
      authorizerAppId,
      'POST',
      `/cgi-bin/material/add_material?type=${type}`,
      body,
    );
    return { mediaId: res.media_id, url: res.url };
  }
}
