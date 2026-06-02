/**
 * 团队协作模块 Zod 契约
 *
 * - InputSchema 严格对应 TeamController method 入参
 * - OutputSchema 对应 InvitationService / ApprovalService / TeamActivityService 实际返回结构
 * - 覆盖邀请 / 审批流 / 审批请求 / 团队活动日志 4 个子域
 *
 * 字段命名: camelCase (V1 风格)
 */
import { z } from 'zod';

// ── 通用子 schema ────────────────────────────────────────────────────────

/** 邀请人简略信息(随邀请一起返回) */
const InviterBriefSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  email: z.string().email(),
});
export type InviterBrief = z.infer<typeof InviterBriefSchema>;

/** 邀请记录 — service.getInvitations 返回 prisma.invitation + inviter */
const InvitationWithInviterSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  inviterId: z.string().min(1),
  email: z.string().email(),
  token: z.string().min(1),
  roleIds: z.array(z.string()),
  authorizerIds: z.array(z.string()),
  status: z.string(),
  expiresAt: z.string().datetime(),
  acceptedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  inviter: InviterBriefSchema,
});
export type InvitationWithInviter = z.infer<typeof InvitationWithInviterSchema>;

/** 审批流 — service.listWorkflows / createWorkflow 直接返回 prisma.approvalWorkflow */
const ApprovalWorkflowSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  authorizerId: z.string().nullable(),
  name: z.string(),
  resourceType: z.string(),
  steps: z.array(z.object({
    order: z.number().int(),
    roleId: z.string().min(1),
    requiredCount: z.number().int(),
  })),
  status: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});
export type ApprovalWorkflow = z.infer<typeof ApprovalWorkflowSchema>;

/** 审批步骤 — 含可选 approver */
const ApprovalStepSchema = z.object({
  id: z.string().min(1),
  requestId: z.string().min(1),
  stepOrder: z.number().int(),
  approverId: z.string(),
  status: z.string(),
  comment: z.string().nullable(),
  actedAt: z.string().datetime().nullable(),
  approver: z.object({
    id: z.string().min(1),
    name: z.string(),
  }).optional(),
});
export type ApprovalStep = z.infer<typeof ApprovalStepSchema>;

/** 审批请求 — service.submitRequest / listPendingRequests 返回 */
const ApprovalRequestSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  workflowId: z.string().min(1),
  resourceType: z.string(),
  resourceId: z.string().min(1),
  submitterId: z.string().min(1),
  status: z.string(),
  currentStep: z.number().int(),
  submittedAt: z.string().datetime(),
  resolvedAt: z.string().datetime().nullable(),
  steps: z.array(ApprovalStepSchema).optional(),
  submitter: z.object({
    id: z.string().min(1),
    name: z.string(),
    email: z.string().email(),
  }).optional(),
  workflow: z.object({
    id: z.string().min(1),
    name: z.string(),
    resourceType: z.string(),
  }).optional(),
});
export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;

/** 团队活动日志条目 — TeamActivity prisma + user */
const TeamActivityLogSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  userId: z.string().min(1),
  action: z.string(),
  targetType: z.string().nullable(),
  targetId: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string().datetime(),
  user: z.object({
    id: z.string().min(1),
    name: z.string(),
    email: z.string().email(),
  }),
});
export type TeamActivityLog = z.infer<typeof TeamActivityLogSchema>;

/** 空响应 (data: null) */
export const VoidResponseSchema = z.null();
export type VoidResponse = z.infer<typeof VoidResponseSchema>;

// ── 4 个 Input schema(对应 4 个带 @Body() 的 method)─────────────────────

/** POST /team/invitations — 发送邀请 */
export const CreateInvitationInputSchema = z.object({
  email: z.string().email('请输入有效邮箱'),
  roleIds: z.array(z.string().min(1)).optional(),
  authorizerIds: z.array(z.string().min(1)).optional(),
});
export type CreateInvitationInput = z.infer<typeof CreateInvitationInputSchema>;

/** POST /team/invitations/:token/accept — 接受邀请(公开) */
export const AcceptInvitationInputSchema = z.object({
  name: z.string().min(1, '请填写姓名'),
  password: z.string().min(6, '密码至少 6 位').max(64, '密码最多 64 位'),
});
export type AcceptInvitationInput = z.infer<typeof AcceptInvitationInputSchema>;

/** POST /team/approval-workflows — 创建审批流(原 @Body() body: any) */
export const CreateWorkflowInputSchema = z.object({
  name: z.string().min(1, '请填写审批流名称'),
  resourceType: z.string().min(1, '请填写资源类型'),
  steps: z.array(z.object({
    order: z.number().int().min(0),
    roleId: z.string().min(1),
    requiredCount: z.number().int().min(1),
  })).min(1, '至少 1 个审批步骤'),
  authorizerId: z.string().min(1).optional(),
});
export type CreateWorkflowInput = z.infer<typeof CreateWorkflowInputSchema>;

/** POST /team/approval-requests — 提交审批 */
export const SubmitApprovalRequestInputSchema = z.object({
  resourceType: z.string().min(1, '请填写资源类型'),
  resourceId: z.string().min(1, '请填写资源 ID'),
  workflowId: z.string().min(1).optional(),
});
export type SubmitApprovalRequestInput = z.infer<typeof SubmitApprovalRequestInputSchema>;

// ── Output schema ───────────────────────────────────────────────────────

/** POST /team/invitations — service.createInvitation 返回 */
export const CreateInvitationOutputSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  token: z.string().min(1),
  expiresAt: z.string().datetime(),
  status: z.string(),
});
export type CreateInvitationOutput = z.infer<typeof CreateInvitationOutputSchema>;

/** GET /team/invitations */
export const ListInvitationsOutputSchema = z.array(InvitationWithInviterSchema);
export type ListInvitationsOutput = z.infer<typeof ListInvitationsOutputSchema>;

/** DELETE /team/invitations/:id */
export const CancelInvitationOutputSchema = z.object({
  cancelled: z.literal(true),
});
export type CancelInvitationOutput = z.infer<typeof CancelInvitationOutputSchema>;

/** POST /team/invitations/:token/accept(公开) */
export const AcceptInvitationOutputSchema = z.object({
  userId: z.string().min(1),
  email: z.string().email(),
  name: z.string(),
});
export type AcceptInvitationOutput = z.infer<typeof AcceptInvitationOutputSchema>;

/** GET /team/approval-workflows */
export const ListWorkflowsOutputSchema = z.array(ApprovalWorkflowSchema);
export type ListWorkflowsOutput = z.infer<typeof ListWorkflowsOutputSchema>;

/** POST /team/approval-workflows */
export const CreateWorkflowOutputSchema = ApprovalWorkflowSchema;
export type CreateWorkflowOutput = z.infer<typeof CreateWorkflowOutputSchema>;

/** POST /team/approval-requests */
export const SubmitApprovalRequestOutputSchema = ApprovalRequestSchema;
export type SubmitApprovalRequestOutput = z.infer<typeof SubmitApprovalRequestOutputSchema>;

/** GET /team/approval-requests */
export const ListApprovalRequestsOutputSchema = z.array(ApprovalRequestSchema);
export type ListApprovalRequestsOutput = z.infer<typeof ListApprovalRequestsOutputSchema>;

/** POST /team/approval-requests/:id/approve */
export const ApproveStepOutputSchema = z.object({
  stepId: z.string().min(1),
  remaining: z.number().int().nonnegative(),
});
export type ApproveStepOutput = z.infer<typeof ApproveStepOutputSchema>;

/** POST /team/approval-requests/:id/reject */
export const RejectRequestOutputSchema = z.object({
  rejected: z.literal(true),
});
export type RejectRequestOutput = z.infer<typeof RejectRequestOutputSchema>;

/** GET /team/activities — 团队活动日志(分页) */
export const GetActivitiesOutputSchema = z.object({
  list: z.array(TeamActivityLogSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  page_size: z.number().int().positive(),
});
export type GetActivitiesOutput = z.infer<typeof GetActivitiesOutputSchema>;
