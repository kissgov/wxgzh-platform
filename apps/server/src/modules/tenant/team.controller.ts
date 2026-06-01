// TeamController — 团队协作 API（邀请/审批/活动日志）
// ============================================================================
import {
  Controller, Get, Post, Delete, Param, Query, Body, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantId, CurrentUser, RequireRoles, Public } from '../../common/decorators/current-user.decorator';
import { InvitationService } from './invitation.service';
import { ApprovalService } from './approval.service';
import { TeamActivityService } from './team-activity.service';

@ApiTags('团队协作')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('team')
export class TeamController {
  constructor(
    private readonly invitationService: InvitationService,
    private readonly approvalService: ApprovalService,
    private readonly teamActivityService: TeamActivityService,
  ) {}

  // ── 邀请管理 ──────────────────────────────────────────────────────

  @Post('invitations')
  @RequireRoles('super_admin', 'admin')
  @ApiOperation({ summary: '发送邀请' })
  async createInvitation(
    @TenantId() tenantId: string,
    @CurrentUser('sub') inviterId: string,
    @Body() body: { email: string; roleIds?: string[]; authorizerIds?: string[] },
  ) {
    try {
      const data = await this.invitationService.createInvitation(tenantId, inviterId, body);
      return { code: 0, message: '邀请已发送', data };
    } catch (err: any) {
      return { code: 10005, message: err.message, data: null };
    }
  }

  @Get('invitations')
  @RequireRoles('super_admin', 'admin')
  @ApiOperation({ summary: '邀请列表' })
  async listInvitations(@TenantId() tenantId: string) {
    const data = await this.invitationService.getInvitations(tenantId);
    return { code: 0, message: '成功', data };
  }

  @Delete('invitations/:id')
  @RequireRoles('super_admin', 'admin')
  @ApiOperation({ summary: '取消邀请' })
  async cancelInvitation(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    try {
      await this.invitationService.cancelInvitation(tenantId, id);
      return { code: 0, message: '邀请已取消', data: null };
    } catch (err: any) {
      return { code: 10005, message: err.message, data: null };
    }
  }

  // ── 接受邀请（公开） ──────────────────────────────────────────────

  @Public()
  @Post('invitations/:token/accept')
  @ApiOperation({ summary: '接受邀请（无需登录）' })
  async acceptInvitation(
    @Param('token') token: string,
    @Body() body: { name: string; password: string },
  ) {
    try {
      const data = await this.invitationService.acceptInvitation(token, body);
      return { code: 0, message: '加入成功，请登录', data };
    } catch (err: any) {
      return { code: 10005, message: err.message, data: null };
    }
  }

  // ── 审批流程 ──────────────────────────────────────────────────────

  @Get('approval-workflows')
  @RequireRoles('super_admin', 'admin')
  @ApiOperation({ summary: '审批流列表' })
  async listWorkflows(@TenantId() tenantId: string) {
    const data = await this.approvalService.listWorkflows(tenantId);
    return { code: 0, message: '成功', data };
  }

  @Post('approval-workflows')
  @RequireRoles('super_admin', 'admin')
  @ApiOperation({ summary: '创建审批流' })
  async createWorkflow(
    @TenantId() tenantId: string,
    @Body() body: any,
  ) {
    const data = await this.approvalService.createWorkflow(tenantId, body);
    return { code: 0, message: '审批流已创建', data };
  }

  @Post('approval-requests')
  @ApiOperation({ summary: '提交审批' })
  async submitRequest(
    @TenantId() tenantId: string,
    @CurrentUser('sub') submitterId: string,
    @Body() body: { resourceType: string; resourceId: string; workflowId?: string },
  ) {
    try {
      const data = await this.approvalService.submitRequest(tenantId, submitterId, body);
      return { code: 0, message: '已提交审批', data };
    } catch (err: any) {
      return { code: 10005, message: err.message, data: null };
    }
  }

  @Get('approval-requests')
  @ApiOperation({ summary: '审批请求列表' })
  async listRequests(
    @TenantId() tenantId: string,
    @CurrentUser('sub') userId: string,
  ) {
    const data = await this.approvalService.listPendingRequests(tenantId, userId);
    return { code: 0, message: '成功', data };
  }

  @Post('approval-requests/:id/approve')
  @ApiOperation({ summary: '通过审批' })
  async approveStep(
    @Param('id') id: string,
    @CurrentUser('sub') approverId: string,
    @Body('comment') comment?: string,
  ) {
    try {
      const data = await this.approvalService.approveStep(id, approverId, comment);
      return { code: 0, message: '已通过', data };
    } catch (err: any) {
      return { code: 10005, message: err.message, data: null };
    }
  }

  @Post('approval-requests/:id/reject')
  @ApiOperation({ summary: '驳回审批' })
  async rejectRequest(
    @Param('id') id: string,
    @CurrentUser('sub') approverId: string,
    @Body('comment') comment?: string,
  ) {
    try {
      const data = await this.approvalService.rejectRequest(id, approverId, comment);
      return { code: 0, message: '已驳回', data };
    } catch (err: any) {
      return { code: 10005, message: err.message, data: null };
    }
  }

  // ── 团队活动日志 ──────────────────────────────────────────────────

  @Get('activities')
  @ApiOperation({ summary: '团队活动日志' })
  async getActivities(
    @TenantId() tenantId: string,
    @Query('page') page?: number,
    @Query('page_size') page_size?: number,
    @Query('action') action?: string,
    @Query('userId') userId?: string,
  ) {
    const data = await this.teamActivityService.getActivities(tenantId, {
      page, page_size, action, userId,
    });
    return { code: 0, message: '成功', data };
  }
}
