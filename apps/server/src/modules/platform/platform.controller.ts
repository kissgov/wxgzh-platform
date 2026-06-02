// Platform Controller — 第三方平台授权管理 API
// ============================================================================
import {
  Controller, Get, Post, Put, Param, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, TenantId, RequirePermission, RequireRoles } from '../../common/decorators/current-user.decorator';
import { ZodBody } from '../../common/decorators/zod-body.decorator';
import { ZodQuery } from '../../common/decorators/zod-query.decorator';
import { ZodResponse } from '../../common/decorators/zod-response.decorator';
import { PlatformService } from './platform.service';
import {
  CreateAuthUrlInputSchema,
  AuthorizerListQuerySchema,
  UpdateComponentAppInputSchema,
  CreateAuthUrlOutputSchema,
  ListAuthorizersOutputSchema,
  GetAuthorizerDetailOutputSchema,
  SyncAuthorizerOutputSchema,
  RevokeAuthorizerOutputSchema,
  GetComponentAppConfigOutputSchema,
  UpdateComponentAppConfigOutputSchema,
  type CreateAuthUrlInput,
  type AuthorizerListQuery,
  type UpdateComponentAppInput,
} from '../../common/contracts/platform.contract';

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
  @ZodResponse(CreateAuthUrlOutputSchema)
  async createAuthUrl(
    @TenantId() tenantId: string,
    @ZodBody(CreateAuthUrlInputSchema) input: CreateAuthUrlInput,
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
  @ZodResponse(ListAuthorizersOutputSchema)
  async listAuthorizers(
    @TenantId() tenantId: string,
    @ZodQuery(AuthorizerListQuerySchema) query: AuthorizerListQuery,
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
  @ZodResponse(GetAuthorizerDetailOutputSchema)
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
  @ZodResponse(SyncAuthorizerOutputSchema)
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
  @ZodResponse(RevokeAuthorizerOutputSchema)
  async revokeAuthorizer(
    @TenantId() tenantId: string,
    @Param('authorizerId') authorizerId: string,
    @CurrentUser('sub') userId: string,
  ) {
    const data = await this.platformService.revokeAuthorizer(tenantId, authorizerId, userId);
    return { code: 0, message: '授权已回收', data };
  }

  // ── ComponentApp 配置(仅管理员可访问)─────────────────────────────

  @Get('component-app')
  @RequireRoles('super_admin')
  @ApiOperation({ summary: '获取第三方平台配置（脱敏）[管理员]' })
  @ZodResponse(GetComponentAppConfigOutputSchema)
  async getComponentAppConfig() {
    const data = await this.platformService.getComponentAppConfig();
    return { code: 0, message: '成功', data };
  }

  @Put('component-app')
  @RequireRoles('super_admin')
  @ApiOperation({ summary: '更新第三方平台配置 [管理员]' })
  @ZodResponse(UpdateComponentAppConfigOutputSchema)
  async updateComponentAppConfig(
    @ZodBody(UpdateComponentAppInputSchema) input: UpdateComponentAppInput,
  ) {
    const data = await this.platformService.upsertComponentApp(input);
    return { code: 0, message: '配置已保存', data };
  }
}
