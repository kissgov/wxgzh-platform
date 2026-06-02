// apps/server/src/integrations/wechat/wechat.client.interface.ts
// 微信 API 客户端抽象: 业务模块只引 IWechatClient, 不直接用 axios 调微信
// V2.0 S6: 建接口, 后续 task 拆分 wechat.service.ts 的 API 调用部分到 WechatClientImpl
export interface IWechatClient {
  getAuthorizerToken(authorizerAppId: string): Promise<string>;
  sendBroadcast(
    authorizerAppId: string,
    payload: unknown,
  ): Promise<{ msgId: string; msgDataId?: string }>;
  getUserList(
    authorizerAppId: string,
    nextOpenId?: string,
  ): Promise<{ openids: string[]; total: number; nextOpenId?: string }>;
  getUserInfo(authorizerAppId: string, openid: string): Promise<unknown>;
  createMenu(authorizerAppId: string, menu: unknown): Promise<void>;
  uploadMedia(
    authorizerAppId: string,
    type: 'image' | 'video' | 'voice' | 'thumb',
    body: Buffer,
    filename: string,
  ): Promise<{ mediaId: string; url: string }>;
}

export const WECHAT_CLIENT = Symbol('WECHAT_CLIENT');
