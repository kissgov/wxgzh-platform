// 通用枚举常量
// ============================================================================

/** 素材类型 */
export const MaterialType = {
  IMAGE: 'image',
  VOICE: 'voice',
  VIDEO: 'video',
  THUMB: 'thumb',
  NEWS: 'news',
} as const;
export type MaterialType = (typeof MaterialType)[keyof typeof MaterialType];

/** 菜单按钮类型 */
export const MenuButtonType = {
  CLICK: 'click',
  VIEW: 'view',
  MINIPROGRAM: 'miniprogram',
  SCANCODE_PUSH: 'scancode_push',
  SCANCODE_WAITMSG: 'scancode_waitmsg',
  PIC_SYSPHOTO: 'pic_sysphoto',
  PIC_PHOTO_OR_ALBUM: 'pic_photo_or_album',
  PIC_WEIXIN: 'pic_weixin',
  LOCATION_SELECT: 'location_select',
  MEDIA_ID: 'media_id',
  VIEW_LIMITED: 'view_limited',
} as const;
export type MenuButtonType = (typeof MenuButtonType)[keyof typeof MenuButtonType];

/** 自动回复规则类型 */
export const ReplyRuleType = {
  FOLLOW: 'follow',
  KEYWORD: 'keyword',
  DEFAULT: 'default',
} as const;
export type ReplyRuleType = (typeof ReplyRuleType)[keyof typeof ReplyRuleType];

/** 关键词匹配模式 */
export const KeywordMatchType = {
  EXACT: 'exact',
  FUZZY: 'fuzzy',
  REGEX: 'regex',
} as const;
export type KeywordMatchType = (typeof KeywordMatchType)[keyof typeof KeywordMatchType];

/** 回复内容类型 */
export const ReplyContentType = {
  TEXT: 'text',
  IMAGE: 'image',
  VOICE: 'voice',
  VIDEO: 'video',
  MUSIC: 'music',
  NEWS: 'news',
  MPNEWS: 'mpnews',
  MINIPROGRAM: 'miniprogram',
} as const;
export type ReplyContentType = (typeof ReplyContentType)[keyof typeof ReplyContentType];

/** 群发消息状态 */
export const BroadcastStatus = {
  DRAFT: 'draft',
  PENDING: 'pending',
  SENDING: 'sending',
  SUCCESS: 'success',
  PARTIAL: 'partial',
  FAILED: 'failed',
} as const;
export type BroadcastStatus = (typeof BroadcastStatus)[keyof typeof BroadcastStatus];

/** 同步任务状态 */
export const SyncTaskStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  SUCCESS: 'success',
  FAILED: 'failed',
} as const;
export type SyncTaskStatus = (typeof SyncTaskStatus)[keyof typeof SyncTaskStatus];
