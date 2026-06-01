// Material API — 素材管理
// ============================================================================
import apiClient from './api-client';
import type { ApiResponse, PaginatedResponse } from '@wxgzh/shared';

/** 获取素材列表 */
export async function getMaterials(query: Record<string, unknown> = {}) {
  const { data } = await apiClient.get<ApiResponse<PaginatedResponse<any>>>('/materials', {
    params: query,
  });
  return data.data;
}

/** 获取素材分类 */
export async function getMaterialCategories() {
  const { data } = await apiClient.get<ApiResponse<Array<{ category: string; count: number }>>>(
    '/materials/categories',
  );
  return data.data || [];
}

/** 上传素材 */
export async function uploadMaterial(authorizerId: string, file: File, meta: Record<string, string> = {}) {
  const form = new FormData();
  form.append('file', file);
  Object.entries(meta).forEach(([k, v]) => form.append(k, v));

  const { data } = await apiClient.post<ApiResponse<any>>('/materials/upload', form, {
    params: { authorizerId },
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data;
}

/** 删除素材 */
export async function deleteMaterial(materialId: string) {
  await apiClient.delete(`/materials/${materialId}`);
}
