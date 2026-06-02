// ContentService 单元测试 — 文章 CRUD / 状态流转 / 分类 / 模板
// ============================================================================
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ContentService } from './content.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrisma: any = {
  article: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  articleRevision: {
    create: jest.fn(),
    findUnique: jest.fn(),
  },
  articleCategory: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  articleTemplate: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  approvalWorkflow: { findFirst: jest.fn() },
  approvalRequest: { create: jest.fn() },
  teamActivity: { create: jest.fn() },
};

describe('ContentService', () => {
  let service: ContentService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContentService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<ContentService>(ContentService);
  });

  // ── getArticles 租户隔离 + 过滤 ───────────────────────────────────

  describe('getArticles (tenant isolation + filters)', () => {
    it('should apply tenantId + authorizerId and forward filters to where', async () => {
      mockPrisma.article.findMany.mockResolvedValue([{ id: 'a1', title: 'T' }]);
      mockPrisma.article.count.mockResolvedValue(1);

      const result = await service.getArticles('t1', 'auth-1', {
        page: 1, page_size: 10, status: 'draft', keyword: 'AI',
      } as any);

      expect(result.list).toHaveLength(1);
      expect(result.total).toBe(1);

      const findCall = mockPrisma.article.findMany.mock.calls[0][0];
      // 越权防护: 必带 tenantId + authorizerId + deletedAt=null
      expect(findCall.where.tenantId).toBe('t1');
      expect(findCall.where.authorizerId).toBe('auth-1');
      expect(findCall.where.deletedAt).toBeNull();
      // 过滤项透传
      expect(findCall.where.status).toBe('draft');
      expect(findCall.where.OR).toEqual([
        { title: { contains: 'AI' } },
        { digest: { contains: 'AI' } },
      ]);
      // 分页
      expect(findCall.skip).toBe(0);
      expect(findCall.take).toBe(10);
    });
  });

  // ── createArticle (含 categoryId) + 初始版本 ─────────────────────

  describe('createArticle (with category + initial revision)', () => {
    it('should create article then snapshot a v1 revision', async () => {
      const created = {
        id: 'a1', tenantId: 't1', authorizerId: 'auth-1',
        title: 'AI 写作', content: '正文', categoryId: 'cat-1',
        digest: '简介', version: 1,
      };
      mockPrisma.article.create.mockResolvedValue(created);
      mockPrisma.articleRevision.create.mockResolvedValue({});

      const result = await service.createArticle('t1', 'auth-1', {
        title: 'AI 写作',
        author: 'Alice',
        content: '正文',
        categoryId: 'cat-1',
        digest: '简介',
      } as any);

      expect(result.id).toBe('a1');
      // article.create 必带所有字段
      expect(mockPrisma.article.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 't1',
          authorizerId: 'auth-1',
          title: 'AI 写作',
          content: '正文',
          categoryId: 'cat-1',
          digest: '简介',
          tags: [],
        }),
      });
      // 必须创建 v1 revision 快照
      expect(mockPrisma.articleRevision.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          articleId: 'a1',
          version: 1,
          title: 'AI 写作',
          content: '正文',
          digest: '简介',
        }),
      });
    });
  });

  // ── updateArticle (含 version 自增 + 越权防护) ──────────────────

  describe('updateArticle (version increment + cross-tenant guard)', () => {
    it('should bump version and snapshot a new revision on update', async () => {
      mockPrisma.article.findFirst.mockResolvedValue({
        id: 'a1', tenantId: 't1', version: 3, deletedAt: null,
      });
      mockPrisma.article.update.mockResolvedValue({ id: 'a1', version: 4, title: '新' });
      mockPrisma.articleRevision.create.mockResolvedValue({});

      const result = await service.updateArticle('t1', 'a1', { title: '新' } as any);

      expect(result.version).toBe(4);
      // update 必传 id(用 where), data 包含新 version
      const updCall = mockPrisma.article.update.mock.calls[0][0];
      expect(updCall.where.id).toBe('a1');
      expect(updCall.data.version).toBe(4); // 3+1
      expect(updCall.data.title).toBe('新');
      // 新版本快照
      expect(mockPrisma.articleRevision.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          articleId: 'a1',
          version: 4,
        }),
      });
    });

    it('should throw NotFoundException when article not in tenant (cross-tenant blocked)', async () => {
      mockPrisma.article.findFirst.mockResolvedValue(null);

      await expect(service.updateArticle('tenant-A', 'article-of-tenant-B', { title: 'x' } as any))
        .rejects.toThrow(NotFoundException);

      // 越权防护: findFirst 必带 tenantId + deletedAt=null
      const findCall = mockPrisma.article.findFirst.mock.calls[0][0];
      expect(findCall.where.tenantId).toBe('tenant-A');
      expect(findCall.where.deletedAt).toBeNull();
      // 不应再调 update
      expect(mockPrisma.article.update).not.toHaveBeenCalled();
    });
  });

  // ── applyTemplate (使用模板创建文章) ─────────────────────────────

  describe('applyTemplate (clone template into article)', () => {
    it('should increment template usageCount and create a new article from template', async () => {
      mockPrisma.articleTemplate.findUnique.mockResolvedValue({
        id: 'tpl-1', name: '节日模板', content: '模板正文', coverUrl: 'https://cdn/x.jpg',
      });
      mockPrisma.articleTemplate.update.mockResolvedValue({});
      mockPrisma.article.create.mockResolvedValue({
        id: 'a-new', title: '来自模板: 节日模板', content: '模板正文',
      });
      mockPrisma.articleRevision.create.mockResolvedValue({});

      const result = await service.applyTemplate('t1', 'auth-1', 'tpl-1');

      // 1. 模板的 usageCount 必 increment
      expect(mockPrisma.articleTemplate.update).toHaveBeenCalledWith({
        where: { id: 'tpl-1' },
        data: { usageCount: { increment: 1 } },
      });
      // 2. 新文章标题含 "来自模板: " 前缀, content 来自模板
      expect(result.title).toBe('来自模板: 节日模板');
      expect(result.content).toBe('模板正文');
      const createCall = mockPrisma.article.create.mock.calls[0][0];
      expect(createCall.data.coverUrl).toBe('https://cdn/x.jpg');
    });

    it('should throw NotFoundException when template missing', async () => {
      mockPrisma.articleTemplate.findUnique.mockResolvedValue(null);

      await expect(service.applyTemplate('t1', 'auth-1', 'missing-tpl'))
        .rejects.toThrow(NotFoundException);

      expect(mockPrisma.article.create).not.toHaveBeenCalled();
    });
  });
});
