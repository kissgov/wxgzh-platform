// Account API — 多公众号管理
// ============================================================================
import apiClient from './api-client';
import type { ApiResponse, PaginatedResponse } from '@wxgzh/shared';

export interface AccountGroup {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  accountCount: number;
}

/** 获取公众号列表 */
export async function getAccounts(query: {
  page?: number;
  page_size?: number;
  groupId?: string;
  keyword?: string;
  appType?: string;
}) {
  const { data } = await apiClient.get<ApiResponse<PaginatedResponse<any>>>(
    '/accounts',
    { params: query },
  );
  return data.data;
}

/** 获取分组树 */
export async function getGroupTree() {
  const { data } = await apiClient.get<ApiResponse<AccountGroup[]>>(
    '/accounts/groups',
  );
  return data.data;
}

/** 创建分组 */
export async function createGroup(params: { name: string; parentId?: string }) {
  const { data } = await apiClient.post<ApiResponse<AccountGroup>>(
    '/accounts/groups',
    params,
  );
  return data.data;
}

/** 编辑分组 */
export async function updateGroup(groupId: string, params: { name?: string; sortOrder?: number }) {
  const { data } = await apiClient.put<ApiResponse<AccountGroup>>(
    `/accounts/groups/${groupId}`,
    params,
  );
  return data.data;
}

/** 删除分组 */
export async function deleteGroup(groupId: string) {
  await apiClient.delete(`/accounts/groups/${groupId}`);
}

/** 添加公众号到分组 */
export async function addAccountsToGroup(groupId: string, authorizerIds: string[]) {
  const { data } = await apiClient.post<ApiResponse<{ added: number }>>(
    `/accounts/groups/${groupId}/items`,
    { authorizerIds },
  );
  return data.data;
}

/** 从分组移除 */
export async function removeFromGroup(groupId: string, authorizerId: string) {
  await apiClient.delete(`/accounts/groups/${groupId}/items/${authorizerId}`);
}
