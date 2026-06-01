// Content Controller — 内容创作 API
// ============================================================================
import {
  Controller, Get, Post, Put, Delete, Param, Query, Body, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantId, CurrentUser, RequirePermission } from '../../common/decorators/current-user.decorator';
import { ContentService } from './content.service';
import {
  ArticleListQueryDto, CreateArticleDto, UpdateArticleDto,
  CreateCategoryDto, CreateTemplateDto, AiGenerateDto,
} from './content.dto';

@ApiTags('内容创作')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('articles')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  // ── 文章 CRUD ──────────────────────────────────────────────────────

  @Get()
  @RequirePermission('follower:read')  // 复用 follower:read 权限（Sprint 2 不新增权限）
  @ApiOperation({ summary: '文章列表' })
  async list(
    @TenantId() tenantId: string,
    @Query('authorizerId') authorizerId: string,
    @Query() query: ArticleListQueryDto,
  ) {
    if (!authorizerId) return { code: 10001, message: 'authorizerId 必填', data: null };
    const data = await this.contentService.getArticles(tenantId, authorizerId, query);
    return { code: 0, message: '成功', data };
  }

  @Get(':id')
  @ApiOperation({ summary: '文章详情' })
  async detail(@TenantId() tenantId: string, @Param('id') id: string) {
    const data = await this.contentService.getArticle(tenantId, id);
    return { code: 0, message: '成功', data };
  }

  @Post()
  @ApiOperation({ summary: '创建文章' })
  async create(
    @TenantId() tenantId: string,
    @Query('authorizerId') authorizerId: string,
    @Body() dto: CreateArticleDto,
  ) {
    if (!authorizerId) return { code: 10001, message: 'authorizerId 必填', data: null };
    const data = await this.contentService.createArticle(tenantId, authorizerId, dto);
    return { code: 0, message: '文章已创建', data };
  }

  @Put(':id')
  @ApiOperation({ summary: '编辑文章' })
  async update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateArticleDto,
  ) {
    const data = await this.contentService.updateArticle(tenantId, id, dto);
    return { code: 0, message: '已保存', data };
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除文章' })
  async delete(@TenantId() tenantId: string, @Param('id') id: string) {
    await this.contentService.deleteArticle(tenantId, id);
    return { code: 0, message: '已删除', data: null };
  }

  // ── 版本管理 ──────────────────────────────────────────────────────

  @Post(':id/revisions/:revId/restore')
  @ApiOperation({ summary: '恢复到指定版本' })
  async restore(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Param('revId') revId: string,
  ) {
    const data = await this.contentService.restoreRevision(tenantId, id, revId);
    return { code: 0, message: '已恢复', data };
  }

  // ── 审批 ───────────────────────────────────────────────────────────

  @Post(':id/submit-review')
  @ApiOperation({ summary: '提交审批' })
  async submitReview(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) {
    try {
      const data = await this.contentService.submitForReview(tenantId, id, userId);
      return { code: 0, message: '已提交审批', data };
    } catch (e: any) {
      return { code: 10005, message: e.message, data: null };
    }
  }

  // ── 分类 ───────────────────────────────────────────────────────────

  @Get('categories/list')
  @ApiOperation({ summary: '文章分类列表' })
  async categories(@TenantId() tenantId: string) {
    const data = await this.contentService.getCategories(tenantId);
    return { code: 0, message: '成功', data };
  }

  @Post('categories')
  @ApiOperation({ summary: '创建分类' })
  async createCategory(@TenantId() tenantId: string, @Body() dto: CreateCategoryDto) {
    const data = await this.contentService.createCategory(tenantId, dto);
    return { code: 0, message: '分类已创建', data };
  }

  @Delete('categories/:id')
  @ApiOperation({ summary: '删除分类' })
  async deleteCategory(@TenantId() tenantId: string, @Param('id') id: string) {
    await this.contentService.deleteCategory(tenantId, id);
    return { code: 0, message: '已删除', data: null };
  }

  // ── 模板 ───────────────────────────────────────────────────────────

  @Get('templates/list')
  @ApiOperation({ summary: '模板列表' })
  async templates(@TenantId() tenantId: string, @Query('category') category?: string) {
    const data = await this.contentService.getTemplates(tenantId, category);
    return { code: 0, message: '成功', data };
  }

  @Post('templates')
  @ApiOperation({ summary: '创建模板' })
  async createTemplate(@TenantId() tenantId: string, @Body() dto: CreateTemplateDto) {
    const data = await this.contentService.createTemplate(tenantId, dto);
    return { code: 0, message: '模板已保存', data };
  }

  @Post('templates/:templateId/apply')
  @ApiOperation({ summary: '应用模板创建文章' })
  async applyTemplate(
    @TenantId() tenantId: string,
    @Query('authorizerId') authorizerId: string,
    @Param('templateId') templateId: string,
  ) {
    if (!authorizerId) return { code: 10001, message: 'authorizerId 必填', data: null };
    const data = await this.contentService.applyTemplate(tenantId, authorizerId, templateId);
    return { code: 0, message: '模板已应用', data };
  }

  @Delete('templates/:templateId')
  @ApiOperation({ summary: '删除模板' })
  async deleteTemplate(@Param('templateId') templateId: string) {
    await this.contentService.deleteTemplate(templateId);
    return { code: 0, message: '已删除', data: null };
  }

  // ── AI 写作 ────────────────────────────────────────────────────────

  @Post('ai/generate')
  @ApiOperation({ summary: 'AI 生成内容' })
  async aiGenerate(@TenantId() tenantId: string, @Body() dto: AiGenerateDto) {
    return {
      code: 0,
      message: 'AI 服务将在后续版本上线',
      data: {
        content: `【AI 生成预览】\n\n主题：${dto.prompt}\n类型：${dto.type}\n\nAI 写作功能将在集成 Claude API 后启用。当前版本请手动编辑文章内容。`,
      },
    };
  }
}
