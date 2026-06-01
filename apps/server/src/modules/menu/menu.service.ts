// Menu Service — 菜单管理
// ============================================================================
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WechatService } from '../../integrations/wechat/wechat.service';
import type { SaveMenuDto, CreateMenuTemplateDto } from './menu.dto';

@Injectable()
export class MenuService {
  private readonly logger = new Logger(MenuService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wechat: WechatService,
  ) {}

  // ── 菜单配置 ────────────────────────────────────────────────────────

  async getCurrentMenu(authorizerId: string) {
    return this.prisma.menuConfig.findFirst({
      where: { authorizerId, status: 'published' },
      orderBy: { publishedAt: 'desc' },
    });
  }

  async getDraftMenu(authorizerId: string) {
    return this.prisma.menuConfig.findFirst({
      where: { authorizerId, status: 'draft' },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async saveDraft(tenantId: string, authorizerId: string, dto: SaveMenuDto) {
    const draft = await this.prisma.menuConfig.findFirst({
      where: { authorizerId, status: 'draft' },
    });

    if (draft) {
      return this.prisma.menuConfig.update({
        where: { id: draft.id },
        data: { menuJson: dto.menuJson as any },
      });
    }

    // 获取当前最大版本号
    const latest = await this.prisma.menuConfig.findFirst({
      where: { authorizerId },
      orderBy: { version: 'desc' },
    });
    const version = (latest?.version || 0) + 1;

    return this.prisma.menuConfig.create({
      data: {
        tenantId,
        authorizerId,
        version,
        menuJson: dto.menuJson as any,
        status: 'draft',
      },
    });
  }

  /** 发布菜单到微信 */
  async publishMenu(tenantId: string, authorizerId: string, publishedBy: string) {
    const draft = await this.prisma.menuConfig.findFirst({
      where: { authorizerId, status: 'draft' },
    });
    if (!draft) throw new NotFoundException('没有待发布的菜单草稿');

    // 调用微信 API 发布菜单
    const result = await this.wechat.request<{ errcode: number; errmsg: string }>(
      authorizerId, 'POST', '/cgi-bin/menu/create', draft.menuJson,
    );

    if (result.errcode !== 0) {
      // 菜单校验错误码
      if (result.errcode >= 40016 && result.errcode <= 40025) {
        throw new BadRequestException(`菜单格式校验失败: [${result.errcode}] ${result.errmsg}`);
      }
      if (result.errcode === 48001) {
        throw new BadRequestException('该公众号未获得菜单管理授权');
      }
      throw new Error(`微信菜单发布失败: [${result.errcode}] ${result.errmsg}`);
    }

    // 标记草稿为已发布
    const published = await this.prisma.menuConfig.update({
      where: { id: draft.id },
      data: { status: 'published', publishedAt: new Date() },
    });

    // 记录发布历史
    await this.prisma.menuPublishHistory.create({
      data: {
        menuConfigId: draft.id,
        version: draft.version,
        menuJson: draft.menuJson as any,
        publishedBy,
      },
    });

    // 将其他已发布版本标记为 archived
    // (不强制，保留历史快照)

    this.logger.log(`Menu published: ${authorizerId} v${draft.version}`);
    return published;
  }

  async getPublishHistory(authorizerId: string, page = 1, page_size = 10) {
    const menus = await this.prisma.menuPublishHistory.findMany({
      where: {
        menuConfig: { authorizerId },
      },
      orderBy: { publishedAt: 'desc' },
      skip: (page - 1) * page_size,
      take: page_size,
    });
    const total = await this.prisma.menuPublishHistory.count({
      where: { menuConfig: { authorizerId } },
    });
    return { list: menus, total, page, page_size };
  }

  // ── 菜单模板 ────────────────────────────────────────────────────────

  async getTemplates(tenantId: string, category?: string) {
    const where: Record<string, unknown> = { tenantId, deletedAt: null };
    if (category) where['category'] = category;
    return this.prisma.menuTemplate.findMany({
      where: where as any,
      orderBy: { usageCount: 'desc' },
    });
  }

  async createTemplate(tenantId: string, dto: CreateMenuTemplateDto) {
    return this.prisma.menuTemplate.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        menuJson: dto.menuJson as any,
        category: dto.category,
      },
    });
  }

  async deleteTemplate(templateId: string) {
    await this.prisma.menuTemplate.update({
      where: { id: templateId },
      data: { deletedAt: new Date() },
    });
    return { deleted: true };
  }

  async applyTemplate(tenantId: string, authorizerId: string, templateId: string) {
    const template = await this.prisma.menuTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template || template.deletedAt) throw new NotFoundException('模板不存在');

    // 应用模板 = 替换当前草稿
    await this.prisma.menuTemplate.update({
      where: { id: templateId },
      data: { usageCount: { increment: 1 } },
    });

    return this.saveDraft(tenantId, authorizerId, { menuJson: template.menuJson as any });
  }
}
