// Platform Controller — 第三方平台授权管理 API
// ============================================================================
import {
  Controller, Get, Post, Put, Param, Query, Body, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, TenantId, RequirePermission, RequireRoles } from '../../common/decorators/current-user.decorator';
import { PlatformService } from './platform.service';
import { CreateAuthUrlDto, AuthorizerListQueryDto, UpdateComponentAppDto } from './platform.dto';

@ApiTags('第三方平台授权')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('platform')
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  /** 生成授权二维码/链接 */
  @Post('auth-url')
  @RequirePermission('platform:create')
  @ApiOperation({ summary: '生成公众号授权二维码链接' })
  @ApiResponse({ status: 200, description: '返回授权 URL 和二维码' })
  async createAuthUrl(
    @TenantId() tenantId: string,
    @Body() dto: CreateAuthUrlDto,
  ) {
    const app = await this.platformService.getActiveComponentApp();
    if (!app) {
      return { code: 20001, message: '未配置第三方平台应用，请先在数据库 component_apps 表中配置', data: null };
    }
    const data = await this.platformService.generateAuthUrl(app.appId, tenantId);
    return { code: 0, message: '成功', data };
  }

  /** 获取授权公众号列表 */
  @Get('authorizers')
  @RequirePermission('platform:read')
  @ApiOperation({ summary: '获取授权公众号列表' })
  @ApiResponse({ status: 200, description: '分页返回授权公众号' })
  async listAuthorizers(
    @TenantId() tenantId: string,
    @Query() query: AuthorizerListQueryDto,
  ) {
    const data = await this.platformService.getAuthorizers(tenantId, query);
    return { code: 0, message: '成功', data };
  }

  /** 获取授权公众号详情 */
  @Get('authorizers/:authorizerId')
  @RequirePermission('platform:read')
  @ApiOperation({ summary: '获取授权公众号详情' })
  @ApiResponse({ status: 200, description: '返回授权公众号完整信息' })
  @ApiResponse({ status: 404, description: '授权公众号不存在' })
  async getAuthorizerDetail(
    @TenantId() tenantId: string,
    @Param('authorizerId') authorizerId: string,
  ) {
    const data = await this.platformService.getAuthorizerDetail(tenantId, authorizerId);
    return { code: 0, message: '成功', data };
  }

  /** 同步公众号基本信息 */
  @Post('authorizers/:authorizerId/sync')
  @RequirePermission('platform:create')
  @ApiOperation({ summary: '从微信同步公众号基本信息' })
  @ApiResponse({ status: 200, description: '同步成功' })
  async syncAuthorizer(
    @TenantId() tenantId: string,
    @Param('authorizerId') authorizerId: string,
  ) {
    const data = await this.platformService.syncAuthorizerInfo(tenantId, authorizerId);
    return { code: 0, message: '同步成功', data };
  }

  /** 回收授权 */
  @Post('authorizers/:authorizerId/revoke')
  @RequirePermission('platform:delete')
  @ApiOperation({ summary: '回收公众号授权' })
  @ApiResponse({ status: 200, description: '回收成功' })
  async revokeAuthorizer(
    @TenantId() tenantId: string,
    @Param('authorizerId') authorizerId: string,
    @CurrentUser('sub') userId: string,
  ) {
    const data = await this.platformService.revokeAuthorizer(tenantId, authorizerId, userId);
    return { code: 0, message: '授权已回收', data };
  }

  // ── ComponentApp 配置（仅管理员可访问）─────────────────────────────

  @Get('component-app')
  @RequireRoles('super_admin')
  @ApiOperation({ summary: '获取第三方平台配置（脱敏）[管理员]' })
  async getComponentAppConfig() {
    const data = await this.platformService.getComponentAppConfig();
    return { code: 0, message: '成功', data };
  }

  @Put('component-app')
  @RequireRoles('super_admin')
  @ApiOperation({ summary: '更新第三方平台配置 [管理员]' })
  async updateComponentAppConfig(
    @Body() dto: UpdateComponentAppDto,
  ) {
    const data = await this.platformService.upsertComponentApp(dto);
    return { code: 0, message: '配置已保存', data };
  }
}
