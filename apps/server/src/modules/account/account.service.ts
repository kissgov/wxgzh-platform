// Account Service — 多公众号管理
// ============================================================================
import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AccountListQueryDto, CreateGroupDto, UpdateGroupDto } from './account.dto';

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── 公众号列表 ────────────────────────────────────────────────────────

  /** 获取租户下的所有授权公众号（含分组信息） */
  async getAccounts(tenantId: string, query: AccountListQueryDto) {
    const { page = 1, page_size = 20, groupId, keyword, appType } = query;

    const where: Record<string, unknown> = {
      tenantId,
      status: 'authorized',
      deletedAt: null,
    };

    if (appType) where['appType'] = parseInt(appType);
    if (keyword) {
      where['OR'] = [
        { nickName: { contains: keyword } },
        { appId: { contains: keyword } },
      ];
    }

    // 如果指定了分组，先查分组内的公众号 ID
    if (groupId) {
      const groupItems = await this.prisma.accountGroupItem.findMany({
        where: { groupId },
        select: { authorizerId: true },
      });
      where['id'] = { in: groupItems.map((i: any) => i.authorizerId) };
    }

    const [list, total] = await Promise.all([
      this.prisma.authorizer.findMany({
        where: where as any,
        include: {
          groupItems: {
            include: { group: { select: { id: true, name: true } } },
          },
        },
        orderBy: { authorizedAt: 'desc' },
        skip: (page - 1) * page_size,
        take: page_size,
      }),
      this.prisma.authorizer.count({ where: where as any }),
    ]);

    const safeList = list.map((a: any) => {
      const { accessToken, refreshToken, ...rest } = a;
      return {
        ...rest,
        groups: (a as any).groupItems?.map((gi: any) => gi.group) || [],
      };
    });

    return { list: safeList, total, page, page_size };
  }

  // ── 分组管理 ──────────────────────────────────────────────────────────

  /** 获取分组树 */
  async getGroupTree(tenantId: string) {
    const groups = await this.prisma.accountGroup.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        items: {
          include: {
            authorizer: {
              select: { id: true, nickName: true, headImg: true, appId: true },
            },
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return groups.map((g: any) => ({
      id: g.id,
      name: g.name,
      parentId: g.parentId,
      sortOrder: g.sortOrder,
      accountCount: g.items.length,
    }));
  }

  /** 创建分组 */
  async createGroup(tenantId: string, dto: CreateGroupDto) {
    const group = await this.prisma.accountGroup.create({
      data: {
        tenantId,
        name: dto.name,
        parentId: dto.parentId,
        sortOrder: dto.sortOrder || 0,
      },
    });
    this.logger.log(`Group created: ${group.name} (${group.id})`);
    return group;
  }

  /** 编辑分组 */
  async updateGroup(tenantId: string, groupId: string, dto: UpdateGroupDto) {
    const group = await this.prisma.accountGroup.findFirst({
      where: { id: groupId, tenantId, deletedAt: null },
    });
    if (!group) throw new NotFoundException('分组不存在');

    const updated = await this.prisma.accountGroup.update({
      where: { id: groupId, tenantId },
      data: { ...dto },
    });
    return updated;
  }

  /** 删除分组 */
  async deleteGroup(tenantId: string, groupId: string) {
    const group = await this.prisma.accountGroup.findFirst({
      where: { id: groupId, tenantId, deletedAt: null },
    });
    if (!group) throw new NotFoundException('分组不存在');

    await this.prisma.accountGroup.update({
      where: { id: groupId, tenantId },
      data: { deletedAt: new Date() },
    });
    return { deleted: true };
  }

  /** 添加公众号到分组 */
  async addToGroup(tenantId: string, groupId: string, authorizerIds: string[]) {
    const group = await this.prisma.accountGroup.findFirst({
      where: { id: groupId, tenantId, deletedAt: null },
    });
    if (!group) throw new NotFoundException('分组不存在');

    const created: unknown[] = [];
    for (const authorizerId of authorizerIds) {
      try {
        const item = await this.prisma.accountGroupItem.create({
          data: { groupId, authorizerId },
        });
        created.push(item);
      } catch (err: any) {
        if (err.code === 'P2002') continue; // 已存在，跳过
        throw err;
      }
    }
    return { added: created.length };
  }

  /** 从分组移除公众号 */
  async removeFromGroup(tenantId: string, groupId: string, authorizerId: string) {
    await this.prisma.accountGroupItem.deleteMany({
      where: { groupId, authorizerId, group: { tenantId } },
    });
    return { removed: true };
  }
}
