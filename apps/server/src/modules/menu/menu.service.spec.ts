// MenuService 单元测试 — 草稿/发布/模板
// ============================================================================
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { MenuService } from './menu.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WechatService } from '../../integrations/wechat/wechat.service';

const mockPrisma: any = {
  menuConfig: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  menuPublishHistory: {
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
  },
  menuTemplate: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

const mockWechat: any = {
  request: jest.fn(),
};

describe('MenuService', () => {
  let service: MenuService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MenuService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: WechatService, useValue: mockWechat },
      ],
    }).compile();
    service = module.get<MenuService>(MenuService);
  });

  // ── saveDraft (3 级菜单 JSON) ────────────────────────────────────────

  describe('saveDraft (3-level menu tree)', () => {
    it('should create a new draft with auto-incremented version when no existing draft', async () => {
      // 没有现存 draft, 最新 version=2
      mockPrisma.menuConfig.findFirst
        .mockResolvedValueOnce(null)   // 查 draft
        .mockResolvedValueOnce({ version: 2 }); // 查 latest
      mockPrisma.menuConfig.create.mockImplementation(async ({ data }: any) => ({
        id: 'cfg-new', ...data,
      }));

      const treeMenu = {
        button: [
          {
            name: '一级菜单A',
            sub_button: [
              { name: '二级A1', type: 'view', url: 'https://a.example' },
              {
                name: '二级A2',
                sub_button: [
                  { name: '三级A2-1', type: 'click', key: 'A2_1' },
                ],
              },
            ],
          },
          { name: '一级菜单B', type: 'click', key: 'B_CLICK' },
        ],
      };

      const result = await service.saveDraft('t1', 'a1', { menuJson: treeMenu });

      // 新 version 必须为 latest.version+1 = 3
      expect(result.version).toBe(3);
      expect(result.status).toBe('draft');
      expect(result.tenantId).toBe('t1');
      expect(result.authorizerId).toBe('a1');
      // 3 级结构应原样保存
      expect((result.menuJson as any).button).toHaveLength(2);
      expect((result.menuJson as any).button[0].sub_button[1].sub_button[0].name)
        .toBe('三级A2-1');
    });

    it('should update existing draft in place (same version, no increment)', async () => {
      mockPrisma.menuConfig.findFirst.mockResolvedValueOnce({
        id: 'cfg-draft', version: 1, status: 'draft',
      });
      mockPrisma.menuConfig.update.mockImplementation(async ({ where, data }: any) => ({
        id: where.id, version: 1, ...data,
      }));

      const result = await service.saveDraft('t1', 'a1', {
        menuJson: { button: [{ name: '更新后', type: 'click', key: 'X' }] },
      });

      expect(result.id).toBe('cfg-draft');
      // 已有草稿: update 不应改变 version
      expect(mockPrisma.menuConfig.update).toHaveBeenCalledWith({
        where: { id: 'cfg-draft' },
        data: { menuJson: { button: [{ name: '更新后', type: 'click', key: 'X' }] } },
      });
      // 不应再调用 findFirst(latest) 或 create
      expect(mockPrisma.menuConfig.create).not.toHaveBeenCalled();
    });
  });

  // ── publishMenu 调微信 API ──────────────────────────────────────────

  describe('publishMenu (Wechat API)', () => {
    it('should throw NotFoundException when no draft exists', async () => {
      mockPrisma.menuConfig.findFirst.mockResolvedValue(null);

      await expect(
        service.publishMenu('t1', 'a1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
      expect(mockWechat.request).not.toHaveBeenCalled();
    });

    it('should call /cgi-bin/menu/create then mark draft as published', async () => {
      mockPrisma.menuConfig.findFirst.mockResolvedValue({
        id: 'cfg-draft', version: 3, status: 'draft',
        menuJson: { button: [{ name: 'M1', type: 'click', key: 'K1' }] },
      });
      mockWechat.request.mockResolvedValue({ errcode: 0, errmsg: 'ok' });
      mockPrisma.menuConfig.update.mockResolvedValue({
        id: 'cfg-draft', status: 'published', publishedAt: expect.any(Date),
      });
      mockPrisma.menuPublishHistory.create.mockResolvedValue({});

      const result = await service.publishMenu('t1', 'a1', 'user-1');

      // 1. 调微信 menu/create
      expect(mockWechat.request).toHaveBeenCalledWith(
        'a1', 'POST', '/cgi-bin/menu/create',
        { button: [{ name: 'M1', type: 'click', key: 'K1' }] },
      );
      // 2. 标记草稿为 published
      expect(mockPrisma.menuConfig.update).toHaveBeenCalledWith({
        where: { id: 'cfg-draft' },
        data: { status: 'published', publishedAt: expect.any(Date) },
      });
      // 3. 写入发布历史
      expect(mockPrisma.menuPublishHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          menuConfigId: 'cfg-draft', version: 3, publishedBy: 'user-1',
        }),
      });
      expect(result.status).toBe('published');
    });

    it('should throw BadRequestException for menu validation error (errcode 40020)', async () => {
      mockPrisma.menuConfig.findFirst.mockResolvedValue({
        id: 'cfg-draft', version: 1, menuJson: { button: [] },
      });
      mockWechat.request.mockResolvedValue({ errcode: 40020, errmsg: 'invalid sub button' });

      await expect(
        service.publishMenu('t1', 'a1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
      // 不应继续标记为 published
      expect(mockPrisma.menuConfig.update).not.toHaveBeenCalled();
    });
  });

  // ── getTemplates 列表 + 模板应用 ─────────────────────────────────────

  describe('templates', () => {
    it('should list templates for tenant filtered by category and ordered by usageCount', async () => {
      mockPrisma.menuTemplate.findMany.mockResolvedValue([
        { id: 't1', name: '电商模板', category: 'ecom', usageCount: 50 },
        { id: 't2', name: '餐饮模板', category: 'ecom', usageCount: 30 },
      ]);

      const result = await service.getTemplates('t1', 'ecom');

      expect(result).toHaveLength(2);
      const call = mockPrisma.menuTemplate.findMany.mock.calls[0][0];
      // 租户隔离 + category 过滤
      expect(call.where.tenantId).toBe('t1');
      expect(call.where.category).toBe('ecom');
      expect(call.where.deletedAt).toBeNull();
      expect(call.orderBy).toEqual({ usageCount: 'desc' });
    });

    it('should apply template by incrementing usageCount and rewriting draft', async () => {
      mockPrisma.menuTemplate.findUnique.mockResolvedValue({
        id: 'tpl-1', menuJson: { button: [{ name: '模板菜单' }] },
      });
      mockPrisma.menuTemplate.update.mockResolvedValue({});
      // 假设无现存 draft, findFirst 序列: draft 查询=null, latest 查询=null
      mockPrisma.menuConfig.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockPrisma.menuConfig.create.mockImplementation(async ({ data }: any) => ({
        id: 'cfg-new', ...data,
      }));

      await service.applyTemplate('t1', 'a1', 'tpl-1');

      // 1. usageCount 自增
      expect(mockPrisma.menuTemplate.update).toHaveBeenCalledWith({
        where: { id: 'tpl-1' },
        data: { usageCount: { increment: 1 } },
      });
      // 2. saveDraft 创建新草稿, menuJson 来自模板
      const createCall = mockPrisma.menuConfig.create.mock.calls[0][0];
      expect(createCall.data.menuJson).toEqual({ button: [{ name: '模板菜单' }] });
      expect(createCall.data.status).toBe('draft');
    });
  });
});
