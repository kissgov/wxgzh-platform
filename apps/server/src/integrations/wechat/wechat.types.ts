// 微信 API 类型定义
// ============================================================================

/** 微信 API 基础响应 */
export interface WechatApiResponse {
  errcode: number;
  errmsg: string;
}

/** 获取 component_access_token 响应 */
export interface ComponentTokenResponse extends WechatApiResponse {
  component_access_token: string;
  expires_in: number;
}

/** 获取预授权码响应 */
export interface PreAuthCodeResponse extends WechatApiResponse {
  pre_auth_code: string;
  expires_in: number;
}

/** 授权信息查询响应 */
export interface QueryAuthResponse extends WechatApiResponse {
  authorization_info: {
    authorizer_appid: string;
    authorizer_access_token: string;
    expires_in: number;
    authorizer_refresh_token: string;
    func_info: Array<{ funcscope_category: { id: number } }>;
  };
}

/** 授权方基本信息 */
export interface AuthorizerInfoResponse extends WechatApiResponse {
  authorizer_info: {
    nick_name: string;
    head_img: string;
    service_type_info: { id: number };
    verify_type_info: { id: number };
    user_name: string;       // 原始 ID
    principal_name: string;  // 主体名称
    qrcode_url: string;
    signature: string;
  };
}

/** 解密后的事件消息 */
export interface WechatEventMessage {
  ToUserName: string;
  FromUserName: string;
  CreateTime: string;
  MsgType: string;
  MsgId?: string;

  // 事件类型
  Event?: string;
  EventKey?: string;
  Ticket?: string;

  // 消息类型
  Content?: string;
  MediaId?: string;
  PicUrl?: string;

  // 授权相关
  InfoType?: string;
  AppId?: string;
  AuthorizationCode?: string;
  AuthorizationCodeExpiredTime?: string;
  PreAuthCode?: string;

  // ComponentVerifyTicket
  ComponentVerifyTicket?: string;
}

/** 微信推送的加密消息体 */
export interface WechatEncryptedMessage {
  ToUserName: string;
  Encrypt: string;
}
