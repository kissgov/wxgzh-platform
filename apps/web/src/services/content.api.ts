// Content API — 内容创作 API 封装
import apiClient from './api-client';
import type { ApiResponse, PaginatedResponse } from '@wxgzh/shared';

export async function getArticles(authorizerId: string, query: Record<string, unknown> = {}) {
  const { data } = await apiClient.get<ApiResponse<PaginatedResponse<any>>>('/articles', {
    params: { authorizerId, ...query },
  });
  return data.data;
}

export async function getArticle(id: string) {
  const { data } = await apiClient.get<ApiResponse<any>>(`/articles/${id}`);
  return data.data;
}

export async function createArticle(authorizerId: string, body: any) {
  const { data } = await apiClient.post<ApiResponse<any>>('/articles', body, {
    params: { authorizerId },
  });
  return data.data;
}

export async function updateArticle(id: string, body: any) {
  const { data } = await apiClient.put<ApiResponse<any>>(`/articles/${id}`, body);
  return data.data;
}

export async function deleteArticle(id: string) {
  await apiClient.delete(`/articles/${id}`);
}

export async function getCategories() {
  const { data } = await apiClient.get<ApiResponse<any[]>>('/articles/categories/list');
  return data.data;
}

export async function createCategory(name: string) {
  const { data } = await apiClient.post<ApiResponse<any>>('/articles/categories', { name });
  return data.data;
}

export async function deleteCategory(id: string) {
  await apiClient.delete(`/articles/categories/${id}`);
}

export async function getTemplates(category?: string) {
  const { data } = await apiClient.get<ApiResponse<any[]>>('/articles/templates/list', {
    params: category ? { category } : {},
  });
  return data.data;
}

export async function createTemplate(body: any) {
  const { data } = await apiClient.post<ApiResponse<any>>('/articles/templates', body);
  return data.data;
}

export async function applyTemplate(authorizerId: string, templateId: string) {
  const { data } = await apiClient.post<ApiResponse<any>>(
    `/articles/templates/${templateId}/apply`,
    {},
    { params: { authorizerId } },
  );
  return data.data;
}

export async function deleteTemplate(id: string) {
  await apiClient.delete(`/articles/templates/${id}`);
}
