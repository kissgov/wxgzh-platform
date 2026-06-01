// Campaign API
import apiClient from './api-client';
import type { ApiResponse, PaginatedResponse } from '@wxgzh/shared';

export async function getCampaigns(authorizerId: string, query?: Record<string, unknown>) {
  const { data } = await apiClient.get<ApiResponse<PaginatedResponse<any>>>('/campaigns', { params: { authorizerId, ...query } });
  return data.data;
}
export async function createCampaign(authorizerId: string, body: any) {
  const { data } = await apiClient.post<ApiResponse<any>>('/campaigns', body, { params: { authorizerId } });
  return data.data;
}
export async function getCampaign(id: string) {
  const { data } = await apiClient.get<ApiResponse<any>>(`/campaigns/${id}`);
  return data.data;
}
export async function updateCampaign(id: string, body: any) {
  const { data } = await apiClient.put<ApiResponse<any>>(`/campaigns/${id}`, body);
  return data.data;
}
export async function deleteCampaign(id: string) { await apiClient.delete(`/campaigns/${id}`); }
export async function changeCampaignStatus(id: string, action: string) {
  const { data } = await apiClient.post<ApiResponse<any>>(`/campaigns/${id}/${action}`);
  return data.data;
}
export async function getQrCodes(authorizerId: string, campaignId?: string) {
  const { data } = await apiClient.get<ApiResponse<any[]>>('/campaigns/qrcodes/list', { params: { authorizerId, campaignId } });
  return data.data;
}
export async function createQrCode(authorizerId: string, body: any) {
  const { data } = await apiClient.post<ApiResponse<any>>('/campaigns/qrcodes', body, { params: { authorizerId } });
  return data.data;
}
export async function deleteQrCode(id: string) { await apiClient.delete(`/campaigns/qrcodes/${id}`); }
