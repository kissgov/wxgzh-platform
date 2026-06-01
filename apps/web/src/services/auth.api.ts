// Auth API — 登录/注册/Token刷新
// ============================================================================
import apiClient from './api-client';
import type { ApiResponse } from '@wxgzh/shared';

export interface LoginData {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: {
    id: string; name: string; email: string; avatar: string | null;
    roles: string[]; permissions: string[];
  };
  tenant: { id: string; name: string; slug: string } | null;
}

export interface RegisterData {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: {
    id: string; name: string; email: string; avatar: string | null;
    roles: string[]; permissions: string[];
  };
  tenant: { id: string; name: string; slug: string };
}

/** 登录 */
export async function login(email: string, password: string) {
  const { data } = await apiClient.post<ApiResponse<LoginData>>('/auth/login', { email, password });
  return data.data;
}

/** 注册 */
export async function register(dto: { name: string; email: string; password: string; company: string }) {
  const { data } = await apiClient.post<ApiResponse<RegisterData>>('/auth/register', dto);
  return data.data;
}

/** 刷新 Token */
export async function refreshToken(refreshTokenStr: string) {
  const { data } = await apiClient.post<ApiResponse<LoginData>>('/auth/refresh', {
    refresh_token: refreshTokenStr,
  });
  return data.data;
}
