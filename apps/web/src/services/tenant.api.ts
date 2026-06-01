// Tenant API — 租户/团队/订阅相关接口
// ============================================================================
import apiClient from './api-client';
import type { ApiResponse } from '@wxgzh/shared';

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
}

export interface SubscriptionInfo {
  plan: string;
  planName: string;
  billingPeriod: string;
  subscriptionExpiresAt: string | null;
  trialEndsAt: string | null;
  maxAuthorizers: number;
  maxUsers: number;
  records: Array<{
    id: string;
    plan: string;
    period: string;
    amount: number;
    startedAt: string;
    expiresAt: string;
    status: string;
  }>;
}

export interface PlanInfo {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  priceMonthly: number;
  priceQuarterly: number;
  priceYearly: number;
  maxAuthorizers: number;
  maxUsers: number;
  trialDays: number;
  color?: string;
  sortOrder?: number;
  features?: string;
}

/** 获取租户列表（超管可见） */
export async function getTenants() {
  const { data } = await apiClient.get<ApiResponse<TenantInfo[]>>('/tenants');
  return (data.data || []) as TenantInfo[];
}

/** 获取当前租户订阅信息 */
export async function getMySubscription() {
  const { data } = await apiClient.get<ApiResponse<SubscriptionInfo>>('/my-subscription');
  return data.data;
}

/** 获取订阅套餐列表 */
export async function getPlans() {
  const { data } = await apiClient.get<ApiResponse<PlanInfo[]>>('/plans');
  return data.data || [];
}

/** 获取当前用户可管理的公众号 */
export async function getMyAuthorizers() {
  const { data } = await apiClient.get<ApiResponse<Array<{ id: string; nickName: string; headImg: string; appType: number }>>>(
    '/my-authorizers',
  );
  return data.data || [];
}

/** 获取当前租户用户列表 */
export async function getUsers() {
  const { data } = await apiClient.get<ApiResponse<any[]>>('/users');
  return data.data || [];
}

/** 获取权限列表 */
export async function getPermissions() {
  const { data } = await apiClient.get<ApiResponse<Record<string, Array<{ id: string; slug: string; name: string; action: string }>>>>(
    '/permissions',
  );
  return data.data || {};
}

/** 获取支付订单 */
export async function getPaymentOrders() {
  const { data } = await apiClient.get<ApiResponse<any[]>>('/payment-orders');
  return data.data || [];
}

/** 创建订阅订单 */
export async function createSubscribeOrder(dto: { plan: string; period: string }) {
  const { data } = await apiClient.post<ApiResponse<{ orderId: string; plan: string; period: string; amount: number }>>(
    '/subscribe', dto,
  );
  return data.data;
}

/** 支付订单 */
export async function payOrder(orderId: string) {
  const { data } = await apiClient.post<ApiResponse<any>>(`/payment-orders/${orderId}/pay`);
  return data.data;
}

// ── 管理端 API ──────────────────────────────────────────────────────────

/** 管理端：租户列表 */
export async function adminGetTenants() {
  const { data } = await apiClient.get<ApiResponse<{ list: any[]; total: number }>>('/admin/tenants');
  return (data.data as any)?.list || [];
}

/** 管理端：更新租户 */
export async function adminUpdateTenant(id: string, payload: Record<string, unknown>) {
  const { data } = await apiClient.put<ApiResponse<any>>(`/admin/tenants/${id}`, payload);
  return data.data;
}

/** 管理端：租户订阅 */
export async function adminSubscribeTenant(id: string, payload: Record<string, unknown>) {
  const { data } = await apiClient.post<ApiResponse<any>>(`/admin/tenants/${id}/subscribe`, payload);
  return data.data;
}

/** 管理端：支付订单列表 */
export async function adminGetPaymentOrders() {
  const { data } = await apiClient.get<ApiResponse<{ list: any[]; total: number }>>('/admin/payment-orders');
  return (data.data as any)?.list || [];
}

/** 管理端：确认收款 */
export async function adminConfirmPayment(id: string) {
  const { data } = await apiClient.post<ApiResponse<any>>(`/admin/payment-orders/${id}/confirm`);
  return data.data;
}

/** 管理端：更新套餐 */
export async function adminUpdatePlan(slug: string, payload: Record<string, unknown>) {
  const { data } = await apiClient.put<ApiResponse<any>>(`/admin/plans/${slug}`, payload);
  return data.data;
}

/** 管理端：获取租户订阅记录 */
export async function adminGetTenantRecords(tenantId: string) {
  const { data } = await apiClient.get<ApiResponse<any[]>>(`/admin/tenants/${tenantId}/records`);
  return data.data || [];
}
