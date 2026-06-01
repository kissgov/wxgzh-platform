// Payment API
import apiClient from './api-client';
import type { ApiResponse, PaginatedResponse } from '@wxgzh/shared';

export async function getPlans() { const { data } = await apiClient.get<ApiResponse<any[]>>('/payment/plans'); return data.data; }
export async function createOrder(body: { plan: string; period: string; method: string }) { const { data } = await apiClient.post<ApiResponse<any>>('/payment/orders', body); return data.data; }
export async function getOrders(page = 1) { const { data } = await apiClient.get<ApiResponse<PaginatedResponse<any>>>('/payment/orders', { params: { page } }); return data.data; }
export async function getPaymentConfig() { const { data } = await apiClient.get<ApiResponse<any>>('/admin/payment-config'); return data.data; }
export async function updatePaymentConfig(body: any) { const { data } = await apiClient.put<ApiResponse<any>>('/admin/payment-config', body); return data.data; }
export async function getAdminPlans() { const { data } = await apiClient.get<ApiResponse<any[]>>('/admin/plans'); return data.data; }
export async function updatePlan(slug: string, body: any) { const { data } = await apiClient.put<ApiResponse<any>>(`/admin/plans/${slug}`, body); return data.data; }
