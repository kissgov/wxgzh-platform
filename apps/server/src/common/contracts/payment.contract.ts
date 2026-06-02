/**
 * 支付订阅模块 Zod 契约
 *
 * - InputSchema 严格对应 PaymentController method 入参
 * - OutputSchema 对应 PaymentService 实际返回结构 (service 是 source of truth)
 * - 覆盖套餐 / 订单 / 支付配置 / Admin 租户订阅 / 支付回调
 *
 * 字段命名: camelCase (V1 风格)
 */
import { z } from 'zod';
import { PageQuerySchema } from './pagination.contract';

// ── 通用子 schema ────────────────────────────────────────────────────────

/** 订阅套餐 — service.getPlans / upsertPlan 实际返回 (prisma.subscriptionPlan)
 *  - features JSONB,允许任意 KV
 *  - status 枚举对齐 prisma
 */
const SubscriptionPlanSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string(),
  description: z.string().nullable(),
  priceMonthly: z.number().int().nonnegative(),
  priceQuarterly: z.number().int().nonnegative(),
  priceYearly: z.number().int().nonnegative(),
  maxAuthorizers: z.number().int().nonnegative(),
  maxUsers: z.number().int().nonnegative(),
  trialDays: z.number().int().nonnegative(),
  features: z.unknown().nullable(),
  sortOrder: z.number().int(),
  status: z.string(), // active | hidden
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type SubscriptionPlan = z.infer<typeof SubscriptionPlanSchema>;

/** 支付订单(基础) — prisma.paymentOrder */
const PaymentOrderBaseSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  plan: z.string(),
  period: z.string(), // monthly | quarterly | yearly
  amount: z.number().int().nonnegative(),
  method: z.string(), // wechat | alipay
  tradeNo: z.string().nullable(),
  qrCodeUrl: z.string().nullable(),
  status: z.string(), // pending | paid | cancelled | refunded
  paidAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type PaymentOrderBase = z.infer<typeof PaymentOrderBaseSchema>;

/** 支付订单(创建结果) — service.createOrder 返回
 *  - 在 PaymentOrderBase 基础上附加 isUpgrade / isDowngrade / isSwitchPeriod
 */
const OrderSchema = PaymentOrderBaseSchema.extend({
  isUpgrade: z.boolean(),
  isDowngrade: z.boolean(),
  isSwitchPeriod: z.boolean(),
});
export type Order = z.infer<typeof OrderSchema>;

/** 支付订单(含租户) — service.adminPaymentOrders list 元素
 *  - 在 PaymentOrderBase 基础上附加 tenantName (来自关联 tenant.name)
 */
const AdminPaymentOrderSchema = PaymentOrderBaseSchema.extend({
  tenantName: z.string(),
});
export type AdminPaymentOrder = z.infer<typeof AdminPaymentOrderSchema>;

/** 支付配置 — service.getPaymentConfig / upsertPaymentConfig 实际返回 (prisma.paymentConfig) */
const PaymentConfigSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  channel: z.string(), // mock | official | thirdparty
  wechatAppId: z.string().nullable(),
  wechatMchId: z.string().nullable(),
  wechatApiKey: z.string().nullable(),
  wechatCertPath: z.string().nullable(),
  alipayAppId: z.string().nullable(),
  alipayPid: z.string().nullable(),
  alipayPrivateKey: z.string().nullable(),
  alipayPublicKey: z.string().nullable(),
  thirdpartyGateway: z.string().nullable(),
  thirdpartyAppId: z.string().nullable(),
  thirdpartyAppKey: z.string().nullable(),
  thirdpartyApiUrl: z.string().nullable(),
  thirdpartyNotifyUrl: z.string().nullable(),
  mockSuccess: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type PaymentConfig = z.infer<typeof PaymentConfigSchema>;

/** 默认支付配置 — controller 在 service.getPaymentConfig 返回空时使用 */
const DefaultPaymentConfigSchema = z.object({
  mode: z.string(),
  mockSuccess: z.boolean(),
  wechatAppId: z.null(),
  wechatMchId: z.null(),
  alipayAppId: z.null(),
});
export type DefaultPaymentConfig = z.infer<typeof DefaultPaymentConfigSchema>;

/** 租户信息(含 _count) — service.adminTenants list 元素 (prisma.tenant + _count) */
const AdminTenantSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  slug: z.string(),
  contact: z.string().nullable(),
  phone: z.string().nullable(),
  status: z.string(),
  config: z.unknown().nullable(),
  plan: z.string().nullable(),
  billingPeriod: z.string().nullable(),
  maxAuthorizers: z.number().int(),
  maxUsers: z.number().int(),
  subscriptionExpiresAt: z.string().datetime().nullable(),
  trialEndsAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
  _count: z.object({
    users: z.number().int().nonnegative(),
    authorizers: z.number().int().nonnegative(),
  }),
});
export type AdminTenant = z.infer<typeof AdminTenantSchema>;

/** 空响应 (data: null) */
export const VoidResponseSchema = z.null();
export type VoidResponse = z.infer<typeof VoidResponseSchema>;

// ── Input schema ─────────────────────────────────────────────────────────

/** POST /payment/orders — 创建支付订单
 *  - 必填:plan / period / method
 *  - period 枚举对齐 V1 service createOrder 的 period 判断
 *  - method 自由字符串 (V1 service 默认 'scan',controller 内联类型未限定)
 */
export const CreateOrderInputSchema = z.object({
  plan: z.string().min(1, '请选择套餐'),
  period: z.enum(['monthly', 'quarterly', 'yearly', 'permanent']),
  method: z.string().min(1, '请选择支付方式'),
});
export type CreateOrderInput = z.infer<typeof CreateOrderInputSchema>;

/** PUT /admin/payment-config — 更新支付配置
 *  - 字段从 service.upsertPaymentConfig 推断
 *  - channel 枚举对齐 prisma.paymentConfig
 *  - 全部可选 (V1 service 内部补默认值)
 */
export const UpdatePaymentConfigInputSchema = z.object({
  channel: z.enum(['mock', 'official', 'thirdparty']).optional(),
  mockSuccess: z.boolean().optional(),
  // 微信
  wechatAppId: z.string().optional(),
  wechatMchId: z.string().optional(),
  wechatApiKey: z.string().optional(),
  wechatCertPath: z.string().optional(),
  // 支付宝
  alipayAppId: z.string().optional(),
  alipayPid: z.string().optional(),
  alipayPrivateKey: z.string().optional(),
  alipayPublicKey: z.string().optional(),
  // 第三方网关
  thirdpartyGateway: z.string().optional(),
  thirdpartyAppId: z.string().optional(),
  thirdpartyAppKey: z.string().optional(),
  thirdpartyApiUrl: z.string().optional(),
  thirdpartyNotifyUrl: z.string().optional(),
});
export type UpdatePaymentConfigInput = z.infer<typeof UpdatePaymentConfigInputSchema>;

/** PUT /admin/plans/:slug — 更新套餐
 *  - slug 来自 URL param,不接 body
 *  - 必填:name (prisma.subscriptionPlan.name 必填)
 *  - 字段从 prisma.subscriptionPlan 推断
 */
export const UpdatePlanInputSchema = z.object({
  name: z.string().min(1, '请填写套餐名称'),
  description: z.string().optional(),
  priceMonthly: z.number().int().nonnegative().optional(),
  priceQuarterly: z.number().int().nonnegative().optional(),
  priceYearly: z.number().int().nonnegative().optional(),
  maxAuthorizers: z.number().int().nonnegative().optional(),
  maxUsers: z.number().int().nonnegative().optional(),
  trialDays: z.number().int().nonnegative().optional(),
  features: z.unknown().optional(),
  sortOrder: z.number().int().optional(),
  status: z.enum(['active', 'hidden']).optional(),
});
export type UpdatePlanInput = z.infer<typeof UpdatePlanInputSchema>;

/** PUT /admin/tenants/:id — 更新租户
 *  - V1 controller 直接把 body 传给 prisma.tenant.update
 *  - 字段从 prisma.tenant 推断,管理后台通常修改订阅/状态/联系人信息
 *  - 全部可选
 */
export const AdminUpdateTenantInputSchema = z.object({
  name: z.string().optional(),
  slug: z.string().optional(),
  contact: z.string().optional(),
  phone: z.string().optional(),
  status: z.enum(['active', 'suspended', 'cancelled']).optional(),
  config: z.any().optional(),
  plan: z.enum(['free', 'starter', 'pro', 'enterprise']).optional(),
  billingPeriod: z.enum(['trial', 'monthly', 'quarterly', 'yearly', 'permanent']).optional(),
  maxAuthorizers: z.number().int().nonnegative().optional(),
  maxUsers: z.number().int().nonnegative().optional(),
  subscriptionExpiresAt: z.string().optional(),
  trialEndsAt: z.string().optional(),
});
export type AdminUpdateTenantInput = z.infer<typeof AdminUpdateTenantInputSchema>;

/** POST /admin/tenants/:id/subscribe — 管理员手动订阅
 *  - 必填:plan / period
 *  - service 用 body.plan / body.period
 */
export const AdminSubscribeTenantInputSchema = z.object({
  plan: z.string().min(1, '请选择套餐'),
  period: z.enum(['monthly', 'quarterly', 'yearly', 'permanent']).default('monthly'),
});
export type AdminSubscribeTenantInput = z.infer<typeof AdminSubscribeTenantInputSchema>;

/** POST /payment/callback/:method — 微信 / 支付宝回调
 *  - 微信 / 支付宝回调体格式不固定 (XML 或 JSON,字段动态)
 *  - V1 controller 提取 out_trade_no / trade_no / result_code / trade_status
 *  - 使用 z.record(z.string(), z.unknown()) 接受任意键值
 */
export const NotifyInputSchema = z.record(z.string(), z.unknown());
export type NotifyInput = z.infer<typeof NotifyInputSchema>;

// ── Output schema ────────────────────────────────────────────────────────

/** GET /payment/plans / GET /admin/plans — service.getPlans 数组 */
export const ListPlansOutputSchema = z.array(SubscriptionPlanSchema);
export type ListPlansOutput = z.infer<typeof ListPlansOutputSchema>;

/** POST /payment/orders — service.createOrder 返回 Order */
export const CreateOrderOutputSchema = OrderSchema;
export type CreateOrderOutput = z.infer<typeof CreateOrderOutputSchema>;

/** GET /payment/orders — service.getOrders 分页
 *  - page_size V1 默认 20,与 PageQuerySchema 默认一致,无需覆盖
 */
export const ListOrdersQuerySchema = PageQuerySchema.pick({ page: true, page_size: true });
export type ListOrdersQuery = z.infer<typeof ListOrdersQuerySchema>;

/** GET /payment/orders — service.getOrders 分页输出 */
export const ListOrdersOutputSchema = z.object({
  list: z.array(PaymentOrderBaseSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  page_size: z.number().int().positive(),
});
export type ListOrdersOutput = z.infer<typeof ListOrdersOutputSchema>;

/** GET /admin/payment-config — service.getPaymentConfig 或默认配置 */
export const GetPaymentConfigOutputSchema = z.union([PaymentConfigSchema, DefaultPaymentConfigSchema]);
export type GetPaymentConfigOutput = z.infer<typeof GetPaymentConfigOutputSchema>;

/** PUT /admin/payment-config — service.upsertPaymentConfig 实际返回 */
export const UpdatePaymentConfigOutputSchema = PaymentConfigSchema;
export type UpdatePaymentConfigOutput = z.infer<typeof UpdatePaymentConfigOutputSchema>;

/** PUT /admin/plans/:slug — service.upsertPlan 实际返回 (prisma.subscriptionPlan) */
export const UpdatePlanOutputSchema = SubscriptionPlanSchema;
export type UpdatePlanOutput = z.infer<typeof UpdatePlanOutputSchema>;

/** GET /admin/tenants — controller 内联分页 { list, total, page, page_size } */
export const ListAdminTenantsOutputSchema = z.object({
  list: z.array(AdminTenantSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  page_size: z.number().int().positive(),
});
export type ListAdminTenantsOutput = z.infer<typeof ListAdminTenantsOutputSchema>;

/** POST /admin/tenants/:id/subscribe — controller 内联返回 PaymentOrder */
export const AdminSubscribeTenantOutputSchema = PaymentOrderBaseSchema;
export type AdminSubscribeTenantOutput = z.infer<typeof AdminSubscribeTenantOutputSchema>;

/** GET /admin/payment-orders — controller 内联分页,list 含 tenantName */
export const ListAdminPaymentOrdersOutputSchema = z.object({
  list: z.array(AdminPaymentOrderSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  page_size: z.number().int().positive(),
});
export type ListAdminPaymentOrdersOutput = z.infer<typeof ListAdminPaymentOrdersOutputSchema>;

/** POST /admin/payment-orders/:id/confirm — controller 内联返回 PaymentOrder */
export const AdminConfirmPaymentOutputSchema = PaymentOrderBaseSchema;
export type AdminConfirmPaymentOutput = z.infer<typeof AdminConfirmPaymentOutputSchema>;

/** POST /payment/callback/:method — 微信 / 支付宝回调响应
 *  - V1 controller 固定返回 { code: 'SUCCESS', message: 'OK' }
 *  - 微信要求 XML,支付宝要求 'success' 字符串
 *  - 当前 V1 始终返回 JSON,保持兼容
 */
export const NotifyOutputSchema = z.object({
  code: z.literal('SUCCESS'),
  message: z.string(),
});
export type NotifyOutput = z.infer<typeof NotifyOutputSchema>;
