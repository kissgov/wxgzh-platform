// Account Controller — 多公众号管理 API
// ============================================================================
import {
  Controller, Get, Post, Put, Delete, Param, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantId, RequirePermission } from '../../common/decorators/current-user.decorator';
import { ZodBody } from '../../common/decorators/zod-body.decorator';
import { ZodQuery } from '../../common/decorators/zod-query.decorator';
import { ZodResponse } from '../../common/decorators/zod-response.decorator';
import { AuditLog } from '../../common/security/audit.interceptor';
import { AccountService } from './account.service';
import {
  AccountListQuerySchema,
  CreateGroupInputSchema,
  UpdateGroupInputSchema,
  AddAccountsToGroupInputSchema,
  ListAccountsOutputSchema,
  GetGroupTreeOutputSchema,
  CreateGroupOutputSchema,
  UpdateGroupOutputSchema,
  DeleteGroupOutputSchema,
  AddToGroupOutputSchema,
  RemoveFromGroupOutputSchema,
  type AccountListQuery,
  type CreateGroupInput,
  type UpdateGroupInput,
  type AddAccountsToGroupInput,
} from '../../common/contracts/account.contract';

@ApiTags('公众号管理')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('accounts')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  // ── 公众号列表 ──────────────────────────────────────────────────────

  @Get()
  @RequirePermission('account:read')
  @ApiOperation({ summary: '获取公众号列表（含分组信息）' })
  @ZodResponse(ListAccountsOutputSchema)
  async listAccounts(
    @TenantId() tenantId: string,
    @ZodQuery(AccountListQuerySchema) query: AccountListQuery,
  ) {
    const data = await this.accountService.getAccounts(tenantId, query);
    return { code: 0, message: '成功', data };
  }

  // ── 分组管理 ────────────────────────────────────────────────────────

  @Get('groups')
  @RequirePermission('account:read')
  @ApiOperation({ summary: '获取分组树' })
  @ZodResponse(GetGroupTreeOutputSchema)
  async getGroupTree(@TenantId() tenantId: string) {
    const data = await this.accountService.getGroupTree(tenantId);
    return { code: 0, message: '成功', data };
  }

  @Post('groups')
  @RequirePermission('account:create')
  @ApiOperation({ summary: '创建分组' })
  @ZodResponse(CreateGroupOutputSchema)
  async createGroup(
    @TenantId() tenantId: string,
    @ZodBody(CreateGroupInputSchema) input: CreateGroupInput,
  ) {
    const data = await this.accountService.createGroup(tenantId, input);
    return { code: 0, message: '分组已创建', data };
  }

  @Put('groups/:groupId')
  @RequirePermission('account:update')
  @ApiOperation({ summary: '编辑分组' })
  @ZodResponse(UpdateGroupOutputSchema)
  async updateGroup(
    @TenantId() tenantId: string,
    @Param('groupId') groupId: string,
    @ZodBody(UpdateGroupInputSchema) input: UpdateGroupInput,
  ) {
    const data = await this.accountService.updateGroup(tenantId, groupId, input);
    return { code: 0, message: '分组已更新', data };
  }

  @Delete('groups/:groupId')
  @RequirePermission('account:delete')
  @AuditLog('account.group.deleted', 'accountGroup')
  @ApiOperation({ summary: '删除分组' })
  @ZodResponse(DeleteGroupOutputSchema)
  async deleteGroup(
    @TenantId() tenantId: string,
    @Param('groupId') groupId: string,
  ) {
    await this.accountService.deleteGroup(tenantId, groupId);
    return { code: 0, message: '分组已删除', data: null };
  }

  @Post('groups/:groupId/items')
  @RequirePermission('account:update')
  @ApiOperation({ summary: '添加公众号到分组' })
  @ZodResponse(AddToGroupOutputSchema)
  async addToGroup(
    @TenantId() tenantId: string,
    @Param('groupId') groupId: string,
    @ZodBody(AddAccountsToGroupInputSchema) input: AddAccountsToGroupInput,
  ) {
    const data = await this.accountService.addToGroup(tenantId, groupId, input.authorizerIds);
    return { code: 0, message: '已添加到分组', data };
  }

  @Delete('groups/:groupId/items/:authorizerId')
  @RequirePermission('account:update')
  @AuditLog('account.group.item.removed', 'accountGroupItem')
  @ApiOperation({ summary: '从分组移除公众号' })
  @ZodResponse(RemoveFromGroupOutputSchema)
  async removeFromGroup(
    @TenantId() tenantId: string,
    @Param('groupId') groupId: string,
    @Param('authorizerId') authorizerId: string,
  ) {
    await this.accountService.removeFromGroup(tenantId, groupId, authorizerId);
    return { code: 0, message: '已从分组移除', data: null };
  }
}
