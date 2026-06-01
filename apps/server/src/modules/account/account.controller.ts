// Account Controller — 多公众号管理 API
// ============================================================================
import {
  Controller, Get, Post, Put, Delete, Param, Query, Body, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantId, RequirePermission } from '../../common/decorators/current-user.decorator';
import { AccountService } from './account.service';
import {
  AccountListQueryDto, CreateGroupDto, UpdateGroupDto, AddAccountsToGroupDto,
} from './account.dto';

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
  async listAccounts(
    @TenantId() tenantId: string,
    @Query() query: AccountListQueryDto,
  ) {
    const data = await this.accountService.getAccounts(tenantId, query);
    return { code: 0, message: '成功', data };
  }

  // ── 分组管理 ────────────────────────────────────────────────────────

  @Get('groups')
  @RequirePermission('account:read')
  @ApiOperation({ summary: '获取分组树' })
  async getGroupTree(@TenantId() tenantId: string) {
    const data = await this.accountService.getGroupTree(tenantId);
    return { code: 0, message: '成功', data };
  }

  @Post('groups')
  @RequirePermission('account:create')
  @ApiOperation({ summary: '创建分组' })
  async createGroup(
    @TenantId() tenantId: string,
    @Body() dto: CreateGroupDto,
  ) {
    const data = await this.accountService.createGroup(tenantId, dto);
    return { code: 0, message: '分组已创建', data };
  }

  @Put('groups/:groupId')
  @RequirePermission('account:update')
  @ApiOperation({ summary: '编辑分组' })
  async updateGroup(
    @TenantId() tenantId: string,
    @Param('groupId') groupId: string,
    @Body() dto: UpdateGroupDto,
  ) {
    const data = await this.accountService.updateGroup(tenantId, groupId, dto);
    return { code: 0, message: '分组已更新', data };
  }

  @Delete('groups/:groupId')
  @RequirePermission('account:delete')
  @ApiOperation({ summary: '删除分组' })
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
  async addToGroup(
    @TenantId() tenantId: string,
    @Param('groupId') groupId: string,
    @Body() dto: AddAccountsToGroupDto,
  ) {
    const data = await this.accountService.addToGroup(tenantId, groupId, dto.authorizerIds);
    return { code: 0, message: '已添加到分组', data };
  }

  @Delete('groups/:groupId/items/:authorizerId')
  @RequirePermission('account:update')
  @ApiOperation({ summary: '从分组移除公众号' })
  async removeFromGroup(
    @TenantId() tenantId: string,
    @Param('groupId') groupId: string,
    @Param('authorizerId') authorizerId: string,
  ) {
    await this.accountService.removeFromGroup(tenantId, groupId, authorizerId);
    return { code: 0, message: '已从分组移除', data: null };
  }
}
