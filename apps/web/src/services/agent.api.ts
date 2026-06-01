// Agent API
import apiClient from './api-client';
import type { ApiResponse, PaginatedResponse } from '@wxgzh/shared';

export async function seedSkills() { await apiClient.post('/agents/seed-skills'); }
export async function getSkills(category?: string) { const { data } = await apiClient.get('/agents/skills', { params: category ? { category } : {} }); return (data as any).data; }
export async function createSkill(body: any) { const { data } = await apiClient.post('/agents/skills', body); return (data as any).data; }
export async function deleteSkill(id: string) { await apiClient.delete(`/agents/skills/${id}`); }
export async function getAgents() { const { data } = await apiClient.get('/agents'); return (data as any).data; }
export async function createAgent(body: any) { const { data } = await apiClient.post('/agents', body); return (data as any).data; }
export async function deleteAgent(id: string) { await apiClient.delete(`/agents/${id}`); }
export async function runAgent(id: string, input: string, skillId?: string) { const { data } = await apiClient.post(`/agents/${id}/run`, { input, skillId }); return (data as any).data; }
export async function getAgentTasks(agentId: string, page = 1) { const { data } = await apiClient.get<ApiResponse<PaginatedResponse<any>>>(`/agents/${agentId}/tasks`, { params: { page } }); return (data as any).data; }
