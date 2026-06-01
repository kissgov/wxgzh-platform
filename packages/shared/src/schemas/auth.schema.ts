// 认证相关 Zod Schemas
// ============================================================================
import { z } from 'zod';

/** 登录请求 */
export const loginSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(6, '密码至少 6 位').max(64),
});

/** 刷新 Token 请求 */
export const refreshTokenSchema = z.object({
  refresh_token: z.string().min(1),
});

/** 用户信息 */
export const userInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  avatar: z.string().nullable(),
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
});

/** 登录响应 */
export const loginResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(),
  user: userInfoSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type UserInfo = z.infer<typeof userInfoSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
