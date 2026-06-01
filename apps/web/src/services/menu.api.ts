// Menu API — 菜单管理
// ============================================================================
import apiClient from './api-client';
import type { ApiResponse } from '@wxgzh/shared';

/** 获取菜单草稿 */
export async function getMenuDraft(authorizerId: string) {
  const { data } = await apiClient.get<ApiResponse<any>>('/menu/draft', {
    params: { authorizerId },
  });
  return data.data;
}

/** 获取当前发布菜单 */
export async function getCurrentMenu(authorizerId: string) {
  const { data } = await apiClient.get<ApiResponse<any>>('/menu/current', {
    params: { authorizerId },
  });
  return data.data;
}

/** 保存菜单草稿 */
export async function saveMenuDraft(authorizerId: string, menuJson: any) {
  const { data } = await apiClient.post<ApiResponse<any>>('/menu', { menuJson }, {
    params: { authorizerId },
  });
  return data.data;
}

/** 发布菜单 */
export async function publishMenu(authorizerId: string) {
  const { data } = await apiClient.post<ApiResponse<any>>('/menu/publish', {}, {
    params: { authorizerId },
  });
  return data.data;
}

/** 获取菜单模板 */
export async function getMenuTemplates(category?: string) {
  const { data } = await apiClient.get<ApiResponse<any[]>>('/menu/templates', {
    params: { category },
  });
  return data.data || [];
}

/** 应用模板 */
export async function applyMenuTemplate(authorizerId: string, templateId: string) {
  const { data } = await apiClient.post<ApiResponse<any>>(`/menu/templates/${templateId}/apply`, {}, {
    params: { authorizerId },
  });
  return data.data;
}

/** 获取发布历史 */
export async function getMenuPublishHistory(authorizerId: string, page = 1) {
  const { data } = await apiClient.get<ApiResponse<any>>('/menu/history', {
    params: { authorizerId, page },
  });
  return data.data;
}
