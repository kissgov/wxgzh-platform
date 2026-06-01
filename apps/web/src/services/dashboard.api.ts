// Dashboard API — 数据看板
// ============================================================================
import apiClient from './api-client';
import type { ApiResponse } from '@wxgzh/shared';

/** 看板概览 */
export async function getDashboardOverview(authorizerId: string) {
  const { data } = await apiClient.get<ApiResponse<any>>('/dashboard/overview', {
    params: { authorizerId },
  });
  return data.data;
}

/** 粉丝趋势 */
export async function getFollowerTrend(authorizerId: string, startDate: string, endDate: string) {
  const { data } = await apiClient.get<ApiResponse<any>>('/dashboard/followers/trend', {
    params: { authorizerId, startDate, endDate },
  });
  return data.data;
}

/** 消息趋势 */
export async function getMessageTrend(authorizerId: string, startDate: string, endDate: string) {
  const { data } = await apiClient.get<ApiResponse<any>>('/dashboard/messages/trend', {
    params: { authorizerId, startDate, endDate },
  });
  return data.data;
}

/** 图文分析 */
export async function getNewsAnalysis(authorizerId: string, startDate: string, endDate: string, page = 1) {
  const { data } = await apiClient.get<ApiResponse<any>>('/dashboard/news', {
    params: { authorizerId, startDate, endDate, page, page_size: 20 },
  });
  return data.data;
}
