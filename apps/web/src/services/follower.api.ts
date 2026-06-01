// Follower API — 粉丝管理
// ============================================================================
import apiClient from './api-client';
import type { ApiResponse, PaginatedResponse } from '@wxgzh/shared';

/** 粉丝列表 */
export async function getFollowers(authorizerId: string, query: Record<string, unknown> = {}) {
  const { data } = await apiClient.get<ApiResponse<PaginatedResponse<any>>>('/followers', {
    params: { authorizerId, ...query },
  });
  return data.data;
}

/** 标签列表 */
export async function getTags(authorizerId: string) {
  const { data } = await apiClient.get<ApiResponse<any[]>>('/followers/tags/list', {
    params: { authorizerId },
  });
  return data.data;
}

/** 创建标签 */
export async function createTag(authorizerId: string, params: { name: string; color?: string }) {
  const { data } = await apiClient.post('/followers/tags', params, {
    params: { authorizerId },
  });
  return data.data;
}

/** 删除标签 */
export async function deleteTag(tagId: string) {
  await apiClient.delete(`/followers/tags/${tagId}`);
}

/** 批量打标签 */
export async function batchTag(params: { followerIds: string[]; tagIds: string[] }) {
  const { data } = await apiClient.post('/followers/tags/batch', params);
  return data.data;
}

/** 批量移除标签 */
export async function batchUntag(params: { followerIds: string[]; tagIds: string[] }) {
  const { data } = await apiClient.delete('/followers/tags/batch', { data: params });
  return data.data;
}

/** 标签规则列表 */
export async function getTagRules(authorizerId: string) {
  const { data } = await apiClient.get('/followers/tags/rules', {
    params: { authorizerId },
  });
  return data.data;
}

/** 创建标签规则 */
export async function createTagRule(authorizerId: string, params: any) {
  const { data } = await apiClient.post('/followers/tags/rules', params, {
    params: { authorizerId },
  });
  return data.data;
}

/** 删除标签规则 */
export async function deleteTagRule(ruleId: string) {
  await apiClient.delete(`/followers/tags/rules/${ruleId}`);
}

/** 执行标签规则 */
export async function executeTagRule(ruleId: string) {
  const { data } = await apiClient.post(`/followers/tags/rules/${ruleId}/execute`);
  return data.data;
}

/** 粉丝画像 */
export async function getPortrait(authorizerId: string) {
  const { data } = await apiClient.get('/followers/portrait/stats', {
    params: { authorizerId },
  });
  return data.data;
}
