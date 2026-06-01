// WechatEvents — 微信集成事件常量（模块间通信契约）
// ============================================================================
export const WechatEvents = {
  TICKET_RECEIVED: 'wechat.ticket.received',
  EVENT_RECEIVED: 'wechat.event.received',
  AUTHORIZATION_SUCCEEDED: 'wechat.authorization.succeeded',
  AUTHORIZATION_UPDATED: 'wechat.authorization.updated',
  AUTHORIZATION_EXPIRED: 'wechat.authorization.expired',
  AUTHORIZATION_REVOKED: 'wechat.authorization.revoked',
} as const;
