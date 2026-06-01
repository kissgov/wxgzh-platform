// 业务错误码
// ============================================================================

export const ErrorCodes = {
  // 通用
  SUCCESS: 0,
  BAD_REQUEST: 10001,
  UNAUTHORIZED: 10002,
  FORBIDDEN: 10003,
  NOT_FOUND: 10004,
  CONFLICT: 10005,
  RATE_LIMITED: 10006,

  // 微信 API
  WECHAT_API_ERROR: 20001,
  WECHAT_TOKEN_EXPIRED: 20002,
  WECHAT_RATE_LIMITED: 20003,

  // 服务器
  INTERNAL_ERROR: 30001,
  DATABASE_ERROR: 30002,
} as const;

export const ErrorMessages: Record<number, string> = {
  [ErrorCodes.SUCCESS]: '成功',
  [ErrorCodes.BAD_REQUEST]: '参数校验失败',
  [ErrorCodes.UNAUTHORIZED]: '未认证或 Token 已过期',
  [ErrorCodes.FORBIDDEN]: '无权限访问',
  [ErrorCodes.NOT_FOUND]: '资源不存在',
  [ErrorCodes.CONFLICT]: '资源冲突',
  [ErrorCodes.RATE_LIMITED]: '请求频率超限，请稍后重试',
  [ErrorCodes.WECHAT_API_ERROR]: '微信 API 调用失败',
  [ErrorCodes.WECHAT_TOKEN_EXPIRED]: '微信 Token 已过期',
  [ErrorCodes.WECHAT_RATE_LIMITED]: '微信 API 调用频率超限',
  [ErrorCodes.INTERNAL_ERROR]: '服务器内部错误',
  [ErrorCodes.DATABASE_ERROR]: '数据库操作失败',
};
