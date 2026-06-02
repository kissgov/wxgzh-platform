/**
 * 认证模块 Zod 契约
 *
 * - 4 个 InputSchema 严格对应 AuthController 的 4 个 method 入参
 * - 4 个 OutputSchema 对应 service 实际返回结构 (service 是 source of truth)
 * - UserInfoSchema / TenantInfoSchema 拆为子 schema,供后续其他 contract 复用
 *
 * 字段命名:camelCase (V1 风格);snake_case 仅出现在 wire 协议字段 (access_token / refresh_token / expires_in)
 */
import { z } from 'zod';

// ── 通用子 schema ──────────────────────────────────────────────────────

/** 当前用户信息 (login / register / me) */
export const UserInfoSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  email: z.string().email(),
  avatar: z.string().nullable(),
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
});
export type UserInfo = z.infer<typeof UserInfoSchema>;

/** 租户简略信息 (login / register) */
export const TenantInfoSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  slug: z.string(),
});
export type TenantInfo = z.infer<typeof TenantInfoSchema>;

// ── 4 个 Input schema (对应 4 个 controller method) ────────────────────

/** POST /auth/login */
export const LoginInputSchema = z.object({
  email: z.string().email('请输入有效邮箱'),
  password: z.string().min(6, '密码至少 6 位').max(64, '密码最多 64 位'),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

/** POST /auth/register */
export const RegisterInputSchema = z.object({
  name: z.string().min(1, '请填写姓名'),
  email: z.string().email('请输入有效邮箱'),
  password: z.string().min(6, '密码至少 6 位').max(64, '密码最多 64 位'),
  company: z.string().min(1, '请填写公司名称'),
});
export type RegisterInput = z.infer<typeof RegisterInputSchema>;

/** PUT /auth/profile */
export const UpdateProfileInputSchema = z.object({
  name: z.string().min(1).optional(),
  oldPassword: z.string().min(6).max(64).optional(),
  newPassword: z.string().min(6, '新密码至少 6 位').max(64).optional(),
});
export type UpdateProfileInput = z.infer<typeof UpdateProfileInputSchema>;

/** POST /auth/refresh */
export const RefreshInputSchema = z.object({
  refresh_token: z.string().min(1, '请提供 refresh_token'),
});
export type RefreshInput = z.infer<typeof RefreshInputSchema>;

// ── 4 个 Output schema ─────────────────────────────────────────────────

/** POST /auth/login — service.login 返回 { token, user, tenant } */
export const LoginOutputSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.literal(7200),
  user: UserInfoSchema,
  tenant: TenantInfoSchema.nullable(),
});
export type LoginOutput = z.infer<typeof LoginOutputSchema>;

/** POST /auth/register — service.register 返回 { token, user, tenant } */
export const RegisterOutputSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.literal(7200),
  user: UserInfoSchema,
  tenant: TenantInfoSchema,
});
export type RegisterOutput = z.infer<typeof RegisterOutputSchema>;

/** PUT /auth/profile — service.updateProfile 返回 { id, name, email, avatar } */
export const UpdateProfileOutputSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  email: z.string().email(),
  avatar: z.string().nullable(),
});
export type UpdateProfileOutput = z.infer<typeof UpdateProfileOutputSchema>;

/** POST /auth/refresh — service.refreshToken 返回新 token 三件套 */
export const RefreshOutputSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.literal(7200),
});
export type RefreshOutput = z.infer<typeof RefreshOutputSchema>;
