// Analytics API — 转化分析
import apiClient from './api-client';
import type { ApiResponse } from '@wxgzh/shared';

export async function getFunnels(authorizerId: string) {
  const { data } = await apiClient.get<ApiResponse<any[]>>('/dashboard/funnels', { params: { authorizerId } });
  return data.data;
}
export async function createFunnel(authorizerId: string, body: any) {
  const { data } = await apiClient.post<ApiResponse<any>>('/dashboard/funnels', body, { params: { authorizerId } });
  return data.data;
}
export async function getFunnelData(id: string) {
  const { data } = await apiClient.get<ApiResponse<any>>(`/dashboard/funnels/${id}/data`);
  return data.data;
}
export async function getRfmOverview(authorizerId: string) {
  const { data } = await apiClient.get<ApiResponse<any[]>>('/dashboard/rfm/overview', { params: { authorizerId } });
  return data.data;
}
export async function computeRfm(authorizerId: string) {
  const { data } = await apiClient.post<ApiResponse<any>>('/dashboard/rfm/compute', {}, { params: { authorizerId } });
  return data.data;
}
