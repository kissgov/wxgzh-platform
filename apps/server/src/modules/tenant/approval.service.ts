// ApprovalService — 审批流程业务逻辑
// ============================================================================
import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ApprovalService {
  private readonly logger = new Logger(ApprovalService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── 审批流定义 ────────────────────────────────────────────────────

  async listWorkflows(tenantId: string) {
    return this.prisma.approvalWorkflow.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createWorkflow(tenantId: string, dto: {
    name: string; resourceType: string; steps: Array<{ order: number; roleId: string; requiredCount: number }>;
    authorizerId?: string;
  }) {
    return this.prisma.approvalWorkflow.create({
      data: {
        tenantId,
        name: dto.name,
        resourceType: dto.resourceType,
        steps: dto.steps as any,
        authorizerId: dto.authorizerId,
      },
    });
  }

  async updateWorkflow(workflowId: string, dto: {
    name?: string; steps?: Array<{ order: number; roleId: string; requiredCount: number }>; status?: string;
  }) {
    const wf = await this.prisma.approvalWorkflow.findUnique({ where: { id: workflowId } });
    if (!wf) throw new NotFoundException('审批流不存在');
    return this.prisma.approvalWorkflow.update({
      where: { id: workflowId },
      data: { ...dto, steps: dto.steps as any },
    });
  }

  async deleteWorkflow(workflowId: string) {
    await this.prisma.approvalWorkflow.update({
      where: { id: workflowId },
      data: { deletedAt: new Date() },
    });
    return { deleted: true };
  }

  // ── 审批请求 ──────────────────────────────────────────────────────

  /** 提交审批 */
  async submitRequest(
    tenantId: string,
    submitterId: string,
    dto: { resourceType: string; resourceId: string; workflowId?: string },
  ) {
    // 查找匹配的审批流
    const workflow = dto.workflowId
      ? await this.prisma.approvalWorkflow.findUnique({ where: { id: dto.workflowId } })
      : await this.prisma.approvalWorkflow.findFirst({
          where: { tenantId, resourceType: dto.resourceType, status: 'enabled', deletedAt: null },
        });

    if (!workflow) throw new NotFoundException('未找到匹配的审批流，请先配置审批流程');

    const steps = workflow.steps as Array<{ order: number; roleId: string; requiredCount: number }>;
    if (!steps.length) throw new BadRequestException('审批流未定义步骤');

    // 创建审批请求
    const request = await this.prisma.approvalRequest.create({
      data: {
        tenantId,
        workflowId: workflow.id,
        resourceType: dto.resourceType,
        resourceId: dto.resourceId,
        submitterId,
        steps: {
          create: steps.map((s) => ({
            stepOrder: s.order,
            approverId: '', // 审批人由角色动态匹配，此处留空，待审批时分配
            status: 'pending',
          })),
        },
      },
      include: { steps: true },
    });

    // 团队活动
    await this.prisma.teamActivity.create({
      data: {
        tenantId,
        userId: submitterId,
        action: `${dto.resourceType}.submitted`,
        targetType: 'approval_request',
        targetId: request.id,
      } as any,
    });

    this.logger.log(`Approval request created: ${request.id}`);
    return request;
  }

  /** 获取待审批列表 */
  async listPendingRequests(tenantId: string, userId?: string) {
    const where: any = { tenantId, status: 'pending' };
    return this.prisma.approvalRequest.findMany({
      where,
      include: {
        submitter: { select: { id: true, name: true, email: true } },
        workflow: { select: { id: true, name: true, resourceType: true } },
        steps: { include: { approver: { select: { id: true, name: true } } } },
      },
      orderBy: { submittedAt: 'desc' },
    });
  }

  /** 通过审批步骤 */
  async approveStep(
    requestId: string,
    approverId: string,
    comment?: string,
  ) {
    const request = await this.prisma.approvalRequest.findUnique({
      where: { id: requestId },
      include: { steps: true },
    });
    if (!request) throw new NotFoundException('审批请求不存在');
    if (request.status !== 'pending') throw new BadRequestException('该审批已结束');

    // 查找当前待处理的步骤
    const currentStep = request.steps
      .filter((s: any) => s.status === 'pending')
      .sort((a: any, b: any) => a.stepOrder - b.stepOrder)[0];

    if (!currentStep) throw new BadRequestException('无待处理步骤');

    // 更新步骤状态
    await this.prisma.approvalStep.update({
      where: { id: currentStep.id },
      data: {
        approverId,
        status: 'approved',
        comment,
        actedAt: new Date(),
      },
    });

    // 检查是否所有步骤都已通过
    const remaining = await this.prisma.approvalStep.count({
      where: { requestId, status: 'pending' },
    });

    if (remaining === 0) {
      // 全部通过 → 标记审批通过
      await this.prisma.approvalRequest.update({
        where: { id: requestId },
        data: { status: 'approved', resolvedAt: new Date() },
      });

      // 团队活动
      await this.prisma.teamActivity.create({
        data: {
          tenantId: request.tenantId,
          userId: approverId,
          action: `${request.resourceType}.approved`,
          targetType: 'approval_request',
          targetId: requestId,
        } as any,
      });
    }

    return { stepId: currentStep.id, remaining };
  }

  /** 驳回审批 */
  async rejectRequest(
    requestId: string,
    approverId: string,
    comment?: string,
  ) {
    const request = await this.prisma.approvalRequest.findUnique({
      where: { id: requestId },
      include: { steps: true },
    });
    if (!request) throw new NotFoundException('审批请求不存在');
    if (request.status !== 'pending') throw new BadRequestException('该审批已结束');

    // 驳回所有未处理的步骤
    await this.prisma.approvalStep.updateMany({
      where: { requestId, status: 'pending' },
      data: { approverId, status: 'rejected', comment, actedAt: new Date() },
    });

    await this.prisma.approvalRequest.update({
      where: { id: requestId },
      data: { status: 'rejected', resolvedAt: new Date() },
    });

    // 团队活动
    await this.prisma.teamActivity.create({
      data: {
        tenantId: request.tenantId,
        userId: approverId,
        action: `${request.resourceType}.rejected`,
        targetType: 'approval_request',
        targetId: requestId,
      } as any,
    });

    return { rejected: true };
  }
}
