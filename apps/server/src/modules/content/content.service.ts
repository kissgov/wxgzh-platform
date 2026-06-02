// Content Service — 文章管理 + 分类 + 模板 + 版本
// ============================================================================
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { businessEventsTotal } from '../../common/observability/metrics';
import type {
  ArticleListQueryDto, CreateArticleDto, UpdateArticleDto,
  CreateCategoryDto, CreateTemplateDto,
} from './content.dto';

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── 文章 CRUD ───────────────────────────────────────────────────────

  async getArticles(tenantId: string, authorizerId: string, query: ArticleListQueryDto) {
    const { page = 1, page_size = 20, status, categoryId, keyword } = query;
    const where: Record<string, unknown> = { tenantId, authorizerId, deletedAt: null };
    if (status) where['status'] = status;
    if (categoryId) where['categoryId'] = categoryId;
    if (keyword) {
      where['OR'] = [
        { title: { contains: keyword } },
        { digest: { contains: keyword } },
      ];
    }

    const [list, total] = await Promise.all([
      this.prisma.article.findMany({
        where: where as any,
        include: { category: { select: { id: true, name: true } } },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * page_size,
        take: page_size,
      }),
      this.prisma.article.count({ where: where as any }),
    ]);
    return { list, total, page, page_size };
  }

  async getArticle(tenantId: string, articleId: string) {
    const article = await this.prisma.article.findFirst({
      where: { id: articleId, tenantId, deletedAt: null },
      include: {
        category: { select: { id: true, name: true } },
        revisions: { orderBy: { version: 'desc' }, take: 20 },
      },
    });
    if (!article) throw new NotFoundException('文章不存在');
    return article;
  }

  async createArticle(tenantId: string, authorizerId: string, dto: CreateArticleDto) {
    const article = await this.prisma.article.create({
      data: {
        tenantId,
        authorizerId,
        title: dto.title,
        author: dto.author,
        digest: dto.digest,
        content: dto.content || '',
        coverUrl: dto.coverUrl,
        categoryId: dto.categoryId,
        tags: dto.tags || [],
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
      },
    });
    // 创建初始版本
    await this.prisma.articleRevision.create({
      data: {
        articleId: article.id,
        version: 1,
        title: article.title,
        content: article.content,
        digest: article.digest,
      },
    });
    businessEventsTotal.inc({ event: 'article_created', tenant_id: tenantId });
    this.logger.log(`Article created: ${article.title}`);
    return article;
  }

  async updateArticle(tenantId: string, articleId: string, dto: UpdateArticleDto) {
    const article = await this.prisma.article.findFirst({
      where: { id: articleId, tenantId, deletedAt: null },
    });
    if (!article) throw new NotFoundException('文章不存在');

    const updated = await this.prisma.article.update({
      where: { id: articleId },
      data: {
        ...dto,
        tags: dto.tags as any,
        version: article.version + 1,
      },
    });

    // 创建新版本快照
    await this.prisma.articleRevision.create({
      data: {
        articleId: article.id,
        version: updated.version,
        title: updated.title,
        content: updated.content,
        digest: updated.digest,
      },
    });

    return updated;
  }

  async deleteArticle(tenantId: string, articleId: string) {
    await this.prisma.article.update({
      where: { id: articleId },
      data: { deletedAt: new Date() },
    });
    return { deleted: true };
  }

  async restoreRevision(tenantId: string, articleId: string, revId: string) {
    const revision = await this.prisma.articleRevision.findUnique({ where: { id: revId } });
    if (!revision || revision.articleId !== articleId) throw new NotFoundException('版本不存在');

    return this.updateArticle(tenantId, articleId, {
      title: revision.title,
      content: revision.content ?? '',
      digest: revision.digest ?? '',
    } as UpdateArticleDto);
  }

  // ── 状态流转 ────────────────────────────────────────────────────────

  async submitForReview(tenantId: string, articleId: string, submitterId: string) {
    const article = await this.prisma.article.findFirst({ where: { id: articleId, tenantId } });
    if (!article) throw new NotFoundException('文章不存在');
    if (article.status !== 'draft') throw new Error('只有草稿状态的文章可以提交审批');

    // 更新状态
    const updated = await this.prisma.article.update({
      where: { id: articleId },
      data: { status: 'pending_review' },
    });

    // 查找匹配的审批流
    const workflow = await this.prisma.approvalWorkflow.findFirst({
      where: { tenantId, resourceType: 'article', status: 'enabled', deletedAt: null },
    });

    if (workflow) {
      const steps = workflow.steps as Array<{ order: number; roleId: string }>;
      await this.prisma.approvalRequest.create({
        data: {
          tenantId,
          workflowId: workflow.id,
          resourceType: 'article',
          resourceId: articleId,
          submitterId,
          steps: steps?.length ? {
            create: steps.map((s) => ({ stepOrder: s.order, approverId: '', status: 'pending' })),
          } : undefined,
        },
      });
    }

    // 记录活动
    await this.prisma.teamActivity.create({
      data: { tenantId, userId: submitterId, action: 'article.submitted', targetType: 'article', targetId: articleId } as any,
    });

    businessEventsTotal.inc({ event: 'article_submitted', tenant_id: tenantId });
    return updated;
  }

  // ── 分类管理 ────────────────────────────────────────────────────────

  async getCategories(tenantId: string) {
    return this.prisma.articleCategory.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createCategory(tenantId: string, dto: CreateCategoryDto) {
    return this.prisma.articleCategory.create({
      data: { tenantId, name: dto.name },
    });
  }

  async deleteCategory(tenantId: string, categoryId: string) {
    await this.prisma.articleCategory.update({
      where: { id: categoryId },
      data: { deletedAt: new Date() },
    });
    return { deleted: true };
  }

  // ── 模板管理 ────────────────────────────────────────────────────────

  async getTemplates(tenantId: string, category?: string) {
    const where: Record<string, unknown> = { tenantId, deletedAt: null };
    if (category) where['category'] = category;
    return this.prisma.articleTemplate.findMany({
      where: where as any,
      orderBy: { usageCount: 'desc' },
    });
  }

  async createTemplate(tenantId: string, dto: CreateTemplateDto) {
    return this.prisma.articleTemplate.create({
      data: { tenantId, ...dto },
    });
  }

  async applyTemplate(tenantId: string, authorizerId: string, templateId: string) {
    const template = await this.prisma.articleTemplate.findUnique({ where: { id: templateId } });
    if (!template) throw new NotFoundException('模板不存在');

    await this.prisma.articleTemplate.update({
      where: { id: templateId },
      data: { usageCount: { increment: 1 } },
    });

    return this.createArticle(tenantId, authorizerId, {
      title: `来自模板: ${template.name}`,
      content: template.content || '',
      coverUrl: template.coverUrl ?? undefined,
    });
  }

  async deleteTemplate(templateId: string) {
    await this.prisma.articleTemplate.update({
      where: { id: templateId },
      data: { deletedAt: new Date() },
    });
    return { deleted: true };
  }
}
