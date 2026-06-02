// Menu Controller — 菜单管理 API
// ============================================================================
import {
  Controller, Get, Post, Delete, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantId, CurrentUser, RequirePermission } from '../../common/decorators/current-user.decorator';
import { ZodBody } from '../../common/decorators/zod-body.decorator';
import { ZodResponse } from '../../common/decorators/zod-response.decorator';
import { MenuService } from './menu.service';
import {
  SaveMenuInputSchema,
  CreateMenuTemplateInputSchema,
  GetCurrentMenuOutputSchema,
  GetDraftMenuOutputSchema,
  SaveMenuOutputSchema,
  PublishMenuOutputSchema,
  GetPublishHistoryOutputSchema,
  ListMenuTemplatesOutputSchema,
  CreateMenuTemplateOutputSchema,
  ApplyMenuTemplateOutputSchema,
  type SaveMenuInput,
  type CreateMenuTemplateInput,
} from '../../common/contracts/menu.contract';

@ApiTags('菜单管理')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get('current')
  @RequirePermission('menu:read')
  @ApiOperation({ summary: '获取当前发布菜单' })
  @ZodResponse(GetCurrentMenuOutputSchema)
  async current(@Query('authorizerId') authorizerId: string) {
    const data = await this.menuService.getCurrentMenu(authorizerId);
    return { code: 0, message: '成功', data };
  }

  @Get('draft')
  @RequirePermission('menu:read')
  @ApiOperation({ summary: '获取菜单草稿' })
  @ZodResponse(GetDraftMenuOutputSchema)
  async draft(@Query('authorizerId') authorizerId: string) {
    const data = await this.menuService.getDraftMenu(authorizerId);
    return { code: 0, message: '成功', data: data || { menuJson: { button: [] } } };
  }

  @Post()
  @RequirePermission('menu:create')
  @ApiOperation({ summary: '保存菜单草稿' })
  @ZodResponse(SaveMenuOutputSchema)
  async save(
    @TenantId() tenantId: string,
    @Query('authorizerId') authorizerId: string,
    @ZodBody(SaveMenuInputSchema) input: SaveMenuInput,
  ) {
    const data = await this.menuService.saveDraft(tenantId, authorizerId, input);
    return { code: 0, message: '草稿已保存', data };
  }

  @Post('publish')
  @RequirePermission('menu:publish')
  @ApiOperation({ summary: '发布菜单到微信' })
  @ZodResponse(PublishMenuOutputSchema)
  async publish(
    @TenantId() tenantId: string,
    @Query('authorizerId') authorizerId: string,
    @CurrentUser('sub') userId: string,
  ) {
    const data = await this.menuService.publishMenu(tenantId, authorizerId, userId);
    return { code: 0, message: '菜单已发布（24小时内生效）', data };
  }

  @Get('history')
  @RequirePermission('menu:read')
  @ApiOperation({ summary: '发布历史' })
  @ZodResponse(GetPublishHistoryOutputSchema)
  async history(
    @Query('authorizerId') authorizerId: string,
    @Query('page') page?: number,
  ) {
    const data = await this.menuService.getPublishHistory(authorizerId, page);
    return { code: 0, message: '成功', data };
  }

  @Get('templates')
  @RequirePermission('menu:read')
  @ApiOperation({ summary: '菜单模板列表' })
  @ZodResponse(ListMenuTemplatesOutputSchema)
  async templates(
    @TenantId() tenantId: string,
    @Query('category') category?: string,
  ) {
    const data = await this.menuService.getTemplates(tenantId, category);
    return { code: 0, message: '成功', data };
  }

  @Post('templates')
  @RequirePermission('menu:create')
  @ApiOperation({ summary: '保存为模板' })
  @ZodResponse(CreateMenuTemplateOutputSchema)
  async createTemplate(
    @TenantId() tenantId: string,
    @ZodBody(CreateMenuTemplateInputSchema) input: CreateMenuTemplateInput,
  ) {
    const data = await this.menuService.createTemplate(tenantId, input);
    return { code: 0, message: '模板已保存', data };
  }

  @Delete('templates/:templateId')
  @RequirePermission('menu:delete')
  @ApiOperation({ summary: '删除模板' })
  async deleteTemplate(@Param('templateId') templateId: string) {
    await this.menuService.deleteTemplate(templateId);
    return { code: 0, message: '模板已删除', data: null };
  }

  @Post('templates/:templateId/apply')
  @RequirePermission('menu:create')
  @ApiOperation({ summary: '应用模板（替换当前草稿）' })
  @ZodResponse(ApplyMenuTemplateOutputSchema)
  async applyTemplate(
    @TenantId() tenantId: string,
    @Query('authorizerId') authorizerId: string,
    @Param('templateId') templateId: string,
  ) {
    const data = await this.menuService.applyTemplate(tenantId, authorizerId, templateId);
    return { code: 0, message: '模板已应用', data };
  }
}
