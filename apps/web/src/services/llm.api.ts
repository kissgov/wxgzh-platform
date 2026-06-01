// LLM API
import apiClient from './api-client';
import type { ApiResponse, PaginatedResponse } from '@wxgzh/shared';

export async function getLlmConfig() { const { data } = await apiClient.get<ApiResponse<any>>('/admin/llm-config'); return data.data; }
export async function updateLlmConfig(body: any) { const { data } = await apiClient.put<ApiResponse<any>>('/admin/llm-config', body); return data.data; }
export async function getLlmStats() { const { data } = await apiClient.get<ApiResponse<any>>('/admin/llm-stats'); return data.data; }
export async function getLlmLogs(page = 1) { const { data } = await apiClient.get<ApiResponse<PaginatedResponse<any>>>('/admin/llm-logs', { params: { page } }); return data.data; }
