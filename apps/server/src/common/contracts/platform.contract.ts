/**
 * 第三方平台授权模块 Zod 契约
 *
 * - InputSchema 严格对应 PlatformController method 入参 (3 个 body / query 入参)
 * - OutputSchema 对应 PlatformService 实际返回结构 (service 是 source of truth)
 * - 覆盖授权 URL 生成 / 授权公众号查询 / 同步 / 回收 / 第三方平台配置
 *
 * 字段命名: camelCase (V1 风格)
 */
import { z } from 'zod';

// ── 通用子 schema ────────────────────────────────────────────────────────

/** ComponentApp 配置 (脱敏后) — service.getComponentAppConfig / upsertComponentApp */
const ComponentAppConfigSchema = z.object({
  id: z.string().min(1),
  appId: z.string().min(1),
  appSecret: z.string(), // 已脱敏,形如 "abcd****wxyz"
  token: z.string(),
  encodingAesKey: z.string(), // 已脱敏
  hasVerifyTicket: z.boolean(),
  status: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ComponentAppConfig = z.infer<typeof ComponentAppConfigSchema>;

/** 生成授权 URL 的返回 — service.generateAuthUrl */
const AuthUrlDataSchema = z.object({
  pre_auth_code: z.string().min(1),
  auth_url: z.string().url(),
  qr_code_url: z.string().url(),
  expires_in: z.number().int(),
});
export type AuthUrlData = z.infer<typeof AuthUrlDataSchema>;

/** 授权公众号列表项 — service.getAuthorizers 投影 (不含 token) */
const AuthorizerListItemSchema = z.object({
  id: z.string().min(1),
  appId: z.string().min(1),
  appType: z.number().int(),
  nickName: z.string(),
  headImg: z.string().nullable(),
  qrcodeUrl: z.string().nullable(),
  principalName: z.string().nullable(),
  funcInfo: z.unknown(),
  status: z.string(),
  authorizedAt: z.string().datetime(),
  expiredAt: z.string().datetime().nullable(),
  lastSyncAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type AuthorizerListItem = z.infer<typeof AuthorizerListItemSchema>;

/** 授权公众号详情/同步返回 — service.getAuthorizerDetail / syncAuthorizerInfo 投影 (去除 accessToken/refreshToken) */
const AuthorizerDetailSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  componentAppId: z.string().min(1),
  appId: z.string().min(1),
  appType: z.number().int(),
  nickName: z.string(),
  headImg: z.string().nullable(),
  qrcodeUrl: z.string().nullable(),
  principalName: z.string().nullable(),
  signature: z.string().nullable(),
  tokenExpireAt: z.string().datetime().nullable(),
  funcInfo: z.unknown(),
  serviceInfo: z.unknown().nullable(),
  verifyInfo: z.unknown().nullable(),
  status: z.string(),
  authorizedAt: z.string().datetime(),
  expiredAt: z.string().datetime().nullable(),
  lastSyncAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});
export type AuthorizerDetail = z.infer<typeof AuthorizerDetailSchema>;

/** 回收授权返回 — service.revokeAuthorizer */
const RevokeAuthorizerDataSchema = z.object({
  status: z.literal('revoked'),
  revokedAt: z.string().datetime(),
});
export type RevokeAuthorizerData = z.infer<typeof RevokeAuthorizerDataSchema>;

// ── 3 个 Input schema ────────────────────────────────────────────────────

/** POST /platform/auth-url — 生成授权链接 (当前 V1 接受空 body, 预留 authorizerId) */
export const CreateAuthUrlInputSchema = z.object({
  authorizerId: z.string().min(1).optional(),
});
export type CreateAuthUrlInput = z.infer<typeof CreateAuthUrlInputSchema>;

/** GET /platform/authorizers — 列表查询 */
export const AuthorizerListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  page_size: z.coerce.number().int().min(1).max(100).optional().default(20),
  keyword: z.string().optional(),
  status: z.enum(['authorized', 'expired', 'revoked']).optional(),
  sort: z.string().optional().default('authorizedAt'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
});
export type AuthorizerListQuery = z.infer<typeof AuthorizerListQuerySchema>;

/** PUT /platform/component-app — 更新第三方平台配置 */
export const UpdateComponentAppInputSchema = z.object({
  appId: z.string().min(1, '请填写 AppID'),
  appSecret: z.string().min(1, '请填写 AppSecret'),
  token: z.string().min(3, 'Token 至少 3 字符').max(32, 'Token 最多 32 字符'),
  encodingAesKey: z.string().min(43, 'EncodingAesKey 必须 43 字符').max(43, 'EncodingAesKey 必须 43 字符'),
});
export type UpdateComponentAppInput = z.infer<typeof UpdateComponentAppInputSchema>;

// ── 7 个 Output schema ───────────────────────────────────────────────────

/** POST /platform/auth-url — service.generateAuthUrl; 失败时 data=null (code=20001) */
export const CreateAuthUrlOutputSchema = AuthUrlDataSchema.nullable();
export type CreateAuthUrlOutput = z.infer<typeof CreateAuthUrlOutputSchema>;

/** GET /platform/authorizers — service.getAuthorizers 分页 */
export const ListAuthorizersOutputSchema = z.object({
  list: z.array(AuthorizerListItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  page_size: z.number().int().positive(),
});
export type ListAuthorizersOutput = z.infer<typeof ListAuthorizersOutputSchema>;

/** GET /platform/authorizers/:id — service.getAuthorizerDetail */
export const GetAuthorizerDetailOutputSchema = AuthorizerDetailSchema;
export type GetAuthorizerDetailOutput = z.infer<typeof GetAuthorizerDetailOutputSchema>;

/** POST /platform/authorizers/:id/sync — service.syncAuthorizerInfo */
export const SyncAuthorizerOutputSchema = AuthorizerDetailSchema;
export type SyncAuthorizerOutput = z.infer<typeof SyncAuthorizerOutputSchema>;

/** POST /platform/authorizers/:id/revoke — service.revokeAuthorizer */
export const RevokeAuthorizerOutputSchema = RevokeAuthorizerDataSchema;
export type RevokeAuthorizerOutput = z.infer<typeof RevokeAuthorizerOutputSchema>;

/** GET /platform/component-app — service.getComponentAppConfig 可能为 null (无配置) */
export const GetComponentAppConfigOutputSchema = ComponentAppConfigSchema.nullable();
export type GetComponentAppConfigOutput = z.infer<typeof GetComponentAppConfigOutputSchema>;

/** PUT /platform/component-app — service.upsertComponentApp */
export const UpdateComponentAppConfigOutputSchema = ComponentAppConfigSchema;
export type UpdateComponentAppConfigOutput = z.infer<typeof UpdateComponentAppConfigOutputSchema>;
