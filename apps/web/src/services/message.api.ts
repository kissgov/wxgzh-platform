// Message API — 自动回复/消息日志/群发
// ============================================================================
import apiClient from './api-client';
import type { ApiResponse } from '@wxgzh/shared';

/** 获取自动回复规则列表 */
export async function getAutoReplyRules(authorizerId: string, ruleType?: string) {
  const { data } = await apiClient.get<ApiResponse<any[]>>('/messages/auto-reply', {
    params: { authorizerId, ruleType },
  });
  return data.data || [];
}

/** 创建自动回复规则 */
export async function createAutoReplyRule(authorizerId: string, payload: any) {
  const { data } = await apiClient.post<ApiResponse<any>>('/messages/auto-reply', payload, {
    params: { authorizerId },
  });
  return data.data;
}

/** 更新自动回复规则 */
export async function updateAutoReplyRule(ruleId: string, payload: any) {
  const { data } = await apiClient.put<ApiResponse<any>>(`/messages/auto-reply/${ruleId}`, payload);
  return data.data;
}

/** 删除自动回复规则 */
export async function deleteAutoReplyRule(ruleId: string) {
  await apiClient.delete(`/messages/auto-reply/${ruleId}`);
}

/** 切换规则启用/禁用 */
export async function toggleAutoReplyRule(ruleId: string) {
  const { data } = await apiClient.patch<ApiResponse<any>>(`/messages/auto-reply/${ruleId}/toggle`);
  return data.data;
}

/** 获取消息日志 */
export async function getMessageLogs(authorizerId: string, query?: Record<string, unknown>) {
  const { data } = await apiClient.get<ApiResponse<any>>('/messages/logs', {
    params: { authorizerId, page: 1, page_size: 30, ...query },
  });
  return data.data;
}
