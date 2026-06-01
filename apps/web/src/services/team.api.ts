// Team API — 团队协作 API 封装
// ============================================================================
import apiClient from './api-client';
import type { ApiResponse, PaginatedResponse } from '@wxgzh/shared';

// ── 邀请 ────────────────────────────────────────────────────────────

export async function createInvitation(body: {
  email: string; roleIds?: string[]; authorizerIds?: string[];
}) {
  const { data } = await apiClient.post<ApiResponse<any>>('/team/invitations', body);
  return data.data;
}

export async function getInvitations() {
  const { data } = await apiClient.get<ApiResponse<any[]>>('/team/invitations');
  return data.data;
}

export async function cancelInvitation(id: string) {
  await apiClient.delete(`/team/invitations/${id}`);
}

// ── 审批流 ──────────────────────────────────────────────────────────

export async function getApprovalWorkflows() {
  const { data } = await apiClient.get<ApiResponse<any[]>>('/team/approval-workflows');
  return data.data;
}

export async function createApprovalWorkflow(body: any) {
  const { data } = await apiClient.post<ApiResponse<any>>('/team/approval-workflows', body);
  return data.data;
}

export async function submitApprovalRequest(body: {
  resourceType: string; resourceId: string; workflowId?: string;
}) {
  const { data } = await apiClient.post<ApiResponse<any>>('/team/approval-requests', body);
  return data.data;
}

export async function getApprovalRequests() {
  const { data } = await apiClient.get<ApiResponse<any[]>>('/team/approval-requests');
  return data.data;
}

export async function approveRequest(id: string, comment?: string) {
  const { data } = await apiClient.post<ApiResponse<any>>(
    `/team/approval-requests/${id}/approve`,
    { comment },
  );
  return data.data;
}

export async function rejectRequest(id: string, comment?: string) {
  const { data } = await apiClient.post<ApiResponse<any>>(
    `/team/approval-requests/${id}/reject`,
    { comment },
  );
  return data.data;
}

// ── 团队活动日志 ────────────────────────────────────────────────────

export async function getTeamActivities(query: {
  page?: number; page_size?: number; action?: string; userId?: string;
} = {}) {
  const { data } = await apiClient.get<ApiResponse<PaginatedResponse<any>>>(
    '/team/activities',
    { params: query },
  );
  return data.data;
}
