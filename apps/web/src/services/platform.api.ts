// Platform API — 第三方平台授权
// ============================================================================
import apiClient from './api-client';
import type { ApiResponse, PaginatedResponse } from '@wxgzh/shared';

export interface AuthorizerItem {
  id: string;
  appId: string;
  appType: number;
  nickName: string;
  headImg: string | null;
  qrcodeUrl: string | null;
  principalName: string | null;
  funcInfo: Array<{ funcscope_category: { id: number } }>;
  status: string;
  authorizedAt: string;
  expiredAt: string | null;
  lastSyncAt: string | null;
}

export interface AuthUrlData {
  pre_auth_code: string;
  auth_url: string;
  qr_code_url: string;
  expires_in: number;
}

/** 生成授权 URL */
export async function generateAuthUrl(params?: { authorizerId?: string }) {
  const { data } = await apiClient.post<ApiResponse<AuthUrlData>>(
    '/platform/auth-url',
    params || {},
  );
  return data.data;
}

/** 获取授权列表 */
export async function getAuthorizers(query: {
  page?: number;
  page_size?: number;
  keyword?: string;
  status?: string;
}) {
  const { data } = await apiClient.get<
    ApiResponse<PaginatedResponse<AuthorizerItem>>
  >('/platform/authorizers', { params: query });
  return data.data;
}

/** 获取授权详情 */
export async function getAuthorizerDetail(authorizerId: string) {
  const { data } = await apiClient.get<ApiResponse<AuthorizerItem>>(
    `/platform/authorizers/${authorizerId}`,
  );
  return data.data;
}

/** 同步基本信息 */
export async function syncAuthorizer(authorizerId: string) {
  const { data } = await apiClient.post<ApiResponse<AuthorizerItem>>(
    `/platform/authorizers/${authorizerId}/sync`,
  );
  return data.data;
}

/** 回收授权 */
export async function revokeAuthorizer(authorizerId: string) {
  const { data } = await apiClient.post<ApiResponse<{ status: string }>>(
    `/platform/authorizers/${authorizerId}/revoke`,
  );
  return data.data;
}

/** 获取 ComponentApp 配置 */
export async function getComponentAppConfig() {
  const { data } = await apiClient.get<ApiResponse<any>>('/platform/component-app');
  return data.data;
}

/** 更新 ComponentApp 配置 */
export async function updateComponentAppConfig(config: {
  appId: string; appSecret: string; token: string; encodingAesKey: string;
}) {
  const { data } = await apiClient.put<ApiResponse<any>>('/platform/component-app', config);
  return data.data;
}
