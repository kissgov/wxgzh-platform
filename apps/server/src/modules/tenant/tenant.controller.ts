// TenantController — 租户内用户 + 角色 + 订阅管理
// ============================================================================
import {
  Controller, Get, Post, Put, Delete, Param, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantId, CurrentUser, RequireRoles } from '../../common/decorators/current-user.decorator';
import { ZodBody } from '../../common/decorators/zod-body.decorator';
import { ZodResponse } from '../../common/decorators/zod-response.decorator';
import { RequirePermission } from '../../common/security/require-permission.decorator';
import { PERMISSIONS } from '../../common/security/permissions';
import { TenantService } from './tenant.service';
import {
  CreateUserInputSchema,
  UpdateUserInputSchema,
  CreateRoleInputSchema,
  UpdateRoleInputSchema,
  ListTenantsOutputSchema,
  ListUsersOutputSchema,
  CreateUserOutputSchema,
  UpdateUserOutputSchema,
  ListRolesOutputSchema,
  CreateRoleOutputSchema,
  UpdateRoleOutputSchema,
  DeleteRoleOutputSchema,
  GetMyAuthorizersOutputSchema,
  GetMySubscriptionOutputSchema,
  ListPlansOutputSchema,
  ListPermissionsOutputSchema,
  type CreateUserInput,
  type UpdateUserInput,
  type CreateRoleInput,
  type UpdateRoleInput,
} from '../../common/contracts/tenant.contract';

@ApiTags('团队管理')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  // ── 租户列表 ────────────────────────────────────────────────────

  @Get('tenants')
  @RequireRoles('super_admin')
  @RequirePermission(PERMISSIONS.PLATFORM_ADMIN)
  @ApiOperation({ summary: '获取租户列表' })
  @ZodResponse(ListTenantsOutputSchema)
  async listTenants() {
    const data = await this.tenantService.getTenants();
    return { code: 0, message: '成功', data };
  }

  // ── 用户管理 ────────────────────────────────────────────────────

  @Get('users')
  @RequireRoles('super_admin', 'admin')
  @RequirePermission(PERMISSIONS.TEAM_READ)
  @ApiOperation({ summary: '获取租户内用户列表' })
  @ZodResponse(ListUsersOutputSchema)
  async listUsers(@TenantId() tenantId: string) {
    const data = await this.tenantService.getUsers(tenantId);
    return { code: 0, message: '成功', data };
  }

  @Post('users')
  @RequireRoles('super_admin', 'admin')
  @RequirePermission(PERMISSIONS.TEAM_WRITE)
  @ApiOperation({ summary: '创建用户' })
  @ZodResponse(CreateUserOutputSchema)
  async createUser(
    @TenantId() tenantId: string,
    @ZodBody(CreateUserInputSchema) input: CreateUserInput,
  ) {
    try {
      const data = await this.tenantService.createUser(tenantId, input);
      return { code: 0, message: '用户已创建', data };
    } catch (err: any) {
      return { code: 10005, message: err.message, data: null };
    }
  }

  @Put('users/:userId')
  @RequireRoles('super_admin', 'admin')
  @RequirePermission(PERMISSIONS.TEAM_WRITE)
  @ApiOperation({ summary: '更新用户' })
  @ZodResponse(UpdateUserOutputSchema)
  async updateUser(
    @Param('userId') userId: string,
    @ZodBody(UpdateUserInputSchema) input: UpdateUserInput,
  ) {
    await this.tenantService.updateUser(userId, input);
    return { code: 0, message: '已更新', data: null };
  }

  // ── 角色管理 ────────────────────────────────────────────────────

  @Get('roles')
  @RequireRoles('super_admin', 'admin')
  @RequirePermission(PERMISSIONS.TEAM_READ)
  @ApiOperation({ summary: '获取租户内角色列表' })
  @ZodResponse(ListRolesOutputSchema)
  async listRoles(@TenantId() tenantId: string) {
    const data = await this.tenantService.getRoles(tenantId);
    return { code: 0, message: '成功', data };
  }

  @Post('roles')
  @RequireRoles('super_admin', 'admin')
  @RequirePermission(PERMISSIONS.TEAM_WRITE)
  @ApiOperation({ summary: '创建角色' })
  @ZodResponse(CreateRoleOutputSchema)
  async createRole(
    @TenantId() tenantId: string,
    @ZodBody(CreateRoleInputSchema) input: CreateRoleInput,
  ) {
    const data = await this.tenantService.createRole(tenantId, input);
    return { code: 0, message: '角色已创建', data };
  }

  @Put('roles/:roleId')
  @RequireRoles('super_admin', 'admin')
  @RequirePermission(PERMISSIONS.TEAM_WRITE)
  @ApiOperation({ summary: '更新角色' })
  @ZodResponse(UpdateRoleOutputSchema)
  async updateRole(
    @Param('roleId') roleId: string,
    @ZodBody(UpdateRoleInputSchema) input: UpdateRoleInput,
  ) {
    await this.tenantService.updateRole(roleId, input);
    return { code: 0, message: '已更新', data: null };
  }

  @Delete('roles/:roleId')
  @RequireRoles('super_admin', 'admin')
  @RequirePermission(PERMISSIONS.TEAM_WRITE)
  @ApiOperation({ summary: '删除角色' })
  @ZodResponse(DeleteRoleOutputSchema)
  async deleteRole(@Param('roleId') roleId: string) {
    try {
      await this.tenantService.deleteRole(roleId);
      return { code: 0, message: '已删除', data: null };
    } catch (err: any) {
      return { code: 10005, message: err.message, data: null };
    }
  }

  // ── 公开接口（所有认证用户可访问）────────────────────────────────

  @Get('my-authorizers')
  @ApiOperation({ summary: '获取当前用户可管理的公众号' })
  @ZodResponse(GetMyAuthorizersOutputSchema)
  async getMyAuthorizers(
    @CurrentUser('sub') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    const data = await this.tenantService.getUserAuthorizers(userId, roles);
    return { code: 0, message: '成功', data };
  }

  @Get('my-subscription')
  @RequirePermission(PERMISSIONS.BILLING_READ)
  @ApiOperation({ summary: '当前租户的订阅信息' })
  @ZodResponse(GetMySubscriptionOutputSchema)
  async getMySubscription(@TenantId() tenantId: string) {
    const data = await this.tenantService.getSubscription(tenantId);
    return { code: 0, message: '成功', data };
  }

  @Get('plans')
  @ApiOperation({ summary: '获取订阅套餐列表' })
  @ZodResponse(ListPlansOutputSchema)
  async listPlans() {
    const data = await this.tenantService.getPlans();
    return { code: 0, message: '成功', data };
  }

  @Get('permissions')
  @ApiOperation({ summary: '获取所有可用权限列表' })
  @ZodResponse(ListPermissionsOutputSchema)
  async listPermissions() {
    const data = await this.tenantService.getPermissions();
    return { code: 0, message: '成功', data };
  }
}
