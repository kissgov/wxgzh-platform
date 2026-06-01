// TenantController — 租户内用户 + 角色 + 订阅管理
// ============================================================================
import {
  Controller, Get, Post, Put, Delete, Param, Body, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantId, CurrentUser, RequireRoles } from '../../common/decorators/current-user.decorator';
import { TenantService } from './tenant.service';

@ApiTags('团队管理')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  // ── 租户列表 ────────────────────────────────────────────────────

  @Get('tenants')
  @RequireRoles('super_admin')
  @ApiOperation({ summary: '获取租户列表' })
  async listTenants() {
    const data = await this.tenantService.getTenants();
    return { code: 0, message: '成功', data };
  }

  // ── 用户管理 ────────────────────────────────────────────────────

  @Get('users')
  @RequireRoles('super_admin', 'admin')
  @ApiOperation({ summary: '获取租户内用户列表' })
  async listUsers(@TenantId() tenantId: string) {
    const data = await this.tenantService.getUsers(tenantId);
    return { code: 0, message: '成功', data };
  }

  @Post('users')
  @RequireRoles('super_admin', 'admin')
  @ApiOperation({ summary: '创建用户' })
  async createUser(
    @TenantId() tenantId: string,
    @Body() body: { name: string; email: string; password: string; roleIds?: string[]; authorizerIds?: string[] },
  ) {
    try {
      const data = await this.tenantService.createUser(tenantId, body);
      return { code: 0, message: '用户已创建', data };
    } catch (err: any) {
      return { code: 10005, message: err.message, data: null };
    }
  }

  @Put('users/:userId')
  @RequireRoles('super_admin', 'admin')
  @ApiOperation({ summary: '更新用户' })
  async updateUser(
    @Param('userId') userId: string,
    @Body() body: { name?: string; status?: string; roleIds?: string[]; authorizerIds?: string[] },
  ) {
    await this.tenantService.updateUser(userId, body);
    return { code: 0, message: '已更新', data: null };
  }

  // ── 角色管理 ────────────────────────────────────────────────────

  @Get('roles')
  @RequireRoles('super_admin', 'admin')
  @ApiOperation({ summary: '获取租户内角色列表' })
  async listRoles(@TenantId() tenantId: string) {
    const data = await this.tenantService.getRoles(tenantId);
    return { code: 0, message: '成功', data };
  }

  @Post('roles')
  @RequireRoles('super_admin', 'admin')
  @ApiOperation({ summary: '创建角色' })
  async createRole(
    @TenantId() tenantId: string,
    @Body() body: { name: string; slug: string; permissionIds?: string[] },
  ) {
    const data = await this.tenantService.createRole(tenantId, body);
    return { code: 0, message: '角色已创建', data };
  }

  @Put('roles/:roleId')
  @RequireRoles('super_admin', 'admin')
  @ApiOperation({ summary: '更新角色' })
  async updateRole(
    @Param('roleId') roleId: string,
    @Body() body: { name?: string; permissionIds?: string[] },
  ) {
    await this.tenantService.updateRole(roleId, body);
    return { code: 0, message: '已更新', data: null };
  }

  @Delete('roles/:roleId')
  @RequireRoles('super_admin', 'admin')
  @ApiOperation({ summary: '删除角色' })
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
  async getMyAuthorizers(
    @CurrentUser('sub') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    const data = await this.tenantService.getUserAuthorizers(userId, roles);
    return { code: 0, message: '成功', data };
  }

  @Get('my-subscription')
  @ApiOperation({ summary: '当前租户的订阅信息' })
  async getMySubscription(@TenantId() tenantId: string) {
    const data = await this.tenantService.getSubscription(tenantId);
    return { code: 0, message: '成功', data };
  }

  @Get('plans')
  @ApiOperation({ summary: '获取订阅套餐列表' })
  async listPlans() {
    const data = await this.tenantService.getPlans();
    return { code: 0, message: '成功', data };
  }

  @Get('permissions')
  @ApiOperation({ summary: '获取所有可用权限列表' })
  async listPermissions() {
    const data = await this.tenantService.getPermissions();
    return { code: 0, message: '成功', data };
  }
}
