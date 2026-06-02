// Content Controller — 内容创作 API
// ============================================================================
import {
  Controller, Get, Post, Put, Delete, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantId, CurrentUser, RequirePermission } from '../../common/decorators/current-user.decorator';
import { ZodBody } from '../../common/decorators/zod-body.decorator';
import { ZodQuery } from '../../common/decorators/zod-query.decorator';
import { ZodResponse } from '../../common/decorators/zod-response.decorator';
import { ContentService } from './content.service';
import {
  ListArticlesQuerySchema,
  CreateArticleInputSchema,
  UpdateArticleInputSchema,
  CreateCategoryInputSchema,
  CreateTemplateInputSchema,
  AiGenerateInputSchema,
  ListArticlesOutputSchema,
  GetArticleOutputSchema,
  CreateArticleOutputSchema,
  UpdateArticleOutputSchema,
  RestoreRevisionOutputSchema,
  SubmitReviewOutputSchema,
  ListCategoriesOutputSchema,
  CreateCategoryOutputSchema,
  ListTemplatesOutputSchema,
  CreateTemplateOutputSchema,
  ApplyTemplateOutputSchema,
  AiGenerateOutputSchema,
  DeleteOutputSchema,
  type ListArticlesQuery,
  type CreateArticleInput,
  type UpdateArticleInput,
  type CreateCategoryInput,
  type CreateTemplateInput,
  type AiGenerateInput,
} from '../../common/contracts/content.contract';

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
  @ZodResponse(ListArticlesOutputSchema)
  async list(
    @TenantId() tenantId: string,
    @Query('authorizerId') authorizerId: string,
    @ZodQuery(ListArticlesQuerySchema) q: ListArticlesQuery,
  ) {
    if (!authorizerId) return { code: 10001, message: 'authorizerId 必填', data: null };
    const data = await this.contentService.getArticles(tenantId, authorizerId, q);
    return { code: 0, message: '成功', data };
  }

  @Get(':id')
  @ApiOperation({ summary: '文章详情' })
  @ZodResponse(GetArticleOutputSchema)
  async detail(@TenantId() tenantId: string, @Param('id') id: string) {
    const data = await this.contentService.getArticle(tenantId, id);
    return { code: 0, message: '成功', data };
  }

  @Post()
  @ApiOperation({ summary: '创建文章' })
  @ZodResponse(CreateArticleOutputSchema)
  async create(
    @TenantId() tenantId: string,
    @Query('authorizerId') authorizerId: string,
    @ZodBody(CreateArticleInputSchema) input: CreateArticleInput,
  ) {
    if (!authorizerId) return { code: 10001, message: 'authorizerId 必填', data: null };
    const data = await this.contentService.createArticle(tenantId, authorizerId, input);
    return { code: 0, message: '文章已创建', data };
  }

  @Put(':id')
  @ApiOperation({ summary: '编辑文章' })
  @ZodResponse(UpdateArticleOutputSchema)
  async update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @ZodBody(UpdateArticleInputSchema) input: UpdateArticleInput,
  ) {
    const data = await this.contentService.updateArticle(tenantId, id, input);
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
  @ZodResponse(RestoreRevisionOutputSchema)
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
  @ZodResponse(SubmitReviewOutputSchema)
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
  @ZodResponse(ListCategoriesOutputSchema)
  async categories(@TenantId() tenantId: string) {
    const data = await this.contentService.getCategories(tenantId);
    return { code: 0, message: '成功', data };
  }

  @Post('categories')
  @ApiOperation({ summary: '创建分类' })
  @ZodResponse(CreateCategoryOutputSchema)
  async createCategory(
    @TenantId() tenantId: string,
    @ZodBody(CreateCategoryInputSchema) input: CreateCategoryInput,
  ) {
    const data = await this.contentService.createCategory(tenantId, input);
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
  @ZodResponse(ListTemplatesOutputSchema)
  async templates(@TenantId() tenantId: string, @Query('category') category?: string) {
    const data = await this.contentService.getTemplates(tenantId, category);
    return { code: 0, message: '成功', data };
  }

  @Post('templates')
  @ApiOperation({ summary: '创建模板' })
  @ZodResponse(CreateTemplateOutputSchema)
  async createTemplate(
    @TenantId() tenantId: string,
    @ZodBody(CreateTemplateInputSchema) input: CreateTemplateInput,
  ) {
    const data = await this.contentService.createTemplate(tenantId, input);
    return { code: 0, message: '模板已保存', data };
  }

  @Post('templates/:templateId/apply')
  @ApiOperation({ summary: '应用模板创建文章' })
  @ZodResponse(ApplyTemplateOutputSchema)
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
  @ZodResponse(AiGenerateOutputSchema)
  async aiGenerate(
    @TenantId() tenantId: string,
    @ZodBody(AiGenerateInputSchema) input: AiGenerateInput,
  ) {
    return {
      code: 0,
      message: 'AI 服务将在后续版本上线',
      data: {
        content: `【AI 生成预览】\n\n主题：${input.prompt}\n类型：${input.type}\n\nAI 写作功能将在集成 Claude API 后启用。当前版本请手动编辑文章内容。`,
      },
    };
  }
}
