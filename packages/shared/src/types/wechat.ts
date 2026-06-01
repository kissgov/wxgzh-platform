// 微信相关类型定义
// ============================================================================

/** 公众号类型 */
export type AppType = 0 | 1 | 2;
// 0 = 订阅号
// 1 = 订阅号（已升级为服务号）
// 2 = 服务号

/** 授权状态 */
export type AuthStatus = 'authorized' | 'expired' | 'revoked';

/** 微信 API 权限集 */
export interface FuncscopeCategory {
  id: number;
}

/** 授权公众号信息 */
export interface IAuthorizerInfo {
  id: string;
  appId: string;
  appType: AppType;
  nickName: string;
  headImg: string | null;
  qrcodeUrl: string | null;
  principalName: string | null;
  signature: string | null;
  funcInfo: FuncscopeCategory[];
  status: AuthStatus;
  authorizedAt: string;
  expiredAt: string | null;
}

/** 微信消息类型 */
export type WechatMsgType =
  | 'text'
  | 'image'
  | 'voice'
  | 'video'
  | 'location'
  | 'link'
  | 'event';

/** 微信事件类型 */
export type WechatEventType =
  | 'subscribe'
  | 'unsubscribe'
  | 'SCAN'
  | 'CLICK'
  | 'VIEW'
  | 'TEMPLATESENDJOBFINISH';

/** 关注来源场景 */
export type SubscribeScene =
  | 'ADD_SCENE_SEARCH'
  | 'ADD_SCENE_QR_CODE'
  | 'ADD_SCENE_ACCOUNT_MIGRATION'
  | 'ADD_SCENE_PROFILE_CARD'
  | 'ADD_SCENE_PROFILE_LINK'
  | 'ADD_SCENE_PROFILE_ITEM'
  | 'ADD_SCENE_PAID'
  | 'ADD_SCENE_WECHAT_ADVERTISEMENT'
  | 'ADD_SCENE_OTHERS';
