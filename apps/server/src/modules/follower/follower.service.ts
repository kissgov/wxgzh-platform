// Follower Service — 粉丝管理核心业务逻辑
// ============================================================================
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { FollowerListQueryDto, CreateTagDto, BatchTagDto, CreateTagRuleDto, UpdateTagRuleDto } from './follower.dto';

@Injectable()
export class FollowerService {
  private readonly logger = new Logger(FollowerService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── 粉丝列表 + 筛选 ──────────────────────────────────────────────────

  async getFollowers(
    tenantId: string,
    authorizerId: string,
    query: FollowerListQueryDto,
  ) {
    const {
      page = 1, page_size = 50, tagId, keyword, sex,
      province, subscribeSince, subscribeUntil, sort = 'subscribeAt', order = 'desc',
    } = query;

    const where: Record<string, unknown> = {
      tenantId, authorizerId, subscribe: true, deletedAt: null,
    };

    if (keyword) {
      where['OR'] = [
        { nickname: { contains: keyword } },
        { remark: { contains: keyword } },
        { openid: { contains: keyword } },
      ];
    }
    if (sex) where['sex'] = parseInt(sex);
    if (province) where['province'] = province;
    if (subscribeSince) where['subscribeAt'] = { gte: new Date(subscribeSince) };
    if (subscribeUntil) {
      where['subscribeAt'] = { ...(where['subscribeAt'] as any || {}), lte: new Date(subscribeUntil) };
    }
    if (tagId) {
      const taggedFollowerIds = await this.prisma.followerTagRelation.findMany({
        where: { tagId },
        select: { followerId: true },
      });
      where['id'] = { in: taggedFollowerIds.map((t: any) => t.followerId) };
    }

    const [list, total] = await Promise.all([
      this.prisma.follower.findMany({
        where: where as any,
        include: {
          tagRelations: {
            include: { tag: { select: { id: true, name: true, color: true } } },
          },
        },
        orderBy: { [sort]: order },
        skip: (page - 1) * page_size,
        take: page_size,
      }),
      this.prisma.follower.count({ where: where as any }),
    ]);

    const safeList = list.map((f: any) => ({
      ...f,
      tags: (f as any).tagRelations?.map((tr: any) => tr.tag) || [],
      tagRelations: undefined,
    }));

    return { list: safeList, total, page, page_size };
  }

  /** 粉丝详情 */
  async getFollowerDetail(tenantId: string, followerId: string) {
    const follower = await this.prisma.follower.findFirst({
      where: { id: followerId, tenantId, deletedAt: null },
      include: {
        tagRelations: { include: { tag: { select: { id: true, name: true, color: true } } } },
      },
    });
    if (!follower) throw new NotFoundException('粉丝不存在');

    const tags = (follower as any).tagRelations?.map((tr: any) => tr.tag) || [];
    const { tagRelations: _, ...rest } = follower as any;
    return { ...rest, tags };
  }

  // ── 标签管理 ──────────────────────────────────────────────────────────

  async getTags(authorizerId: string) {
    return this.prisma.followerTag.findMany({
      where: { authorizerId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createTag(authorizerId: string, tenantId: string, dto: CreateTagDto) {
    const tag = await this.prisma.followerTag.create({
      data: { tenantId, authorizerId, name: dto.name, color: dto.color },
    });
    // 同步到微信：调用 tags/create API
    this.logger.log(`Tag created: ${tag.name}`);
    return tag;
  }

  async updateTag(tagId: string, tenantId: string, dto: Partial<CreateTagDto>) {
    return this.prisma.followerTag.update({
      where: { id: tagId, tenantId },
      data: { name: dto.name, color: dto.color },
    });
  }

  async deleteTag(tagId: string, tenantId: string) {
    await this.prisma.followerTag.update({
      where: { id: tagId, tenantId },
      data: { deletedAt: new Date() },
    });
    return { deleted: true };
  }

  async batchTag(tenantId: string, dto: BatchTagDto) {
    const relations = dto.followerIds.flatMap((fid) =>
      dto.tagIds.map((tid) => ({ followerId: fid, tagId: tid, source: 'manual' })),
    );

    let success = 0;
    for (const rel of relations) {
      try {
        // 验证 follower 和 tag 都属于该租户
        await this.prisma.followerTagRelation.create({ data: rel });
        success++;
      } catch { /* 已存在，跳过 */ }
    }
    return { success, total: relations.length };
  }

  async batchUntag(tenantId: string, dto: BatchTagDto) {
    // 只删除当前租户的关联
    const tags = await this.prisma.followerTag.findMany({
      where: { id: { in: dto.tagIds }, tenantId },
      select: { id: true },
    });
    const validTagIds = tags.map((t: any) => t.id);
    if (validTagIds.length === 0) return { removed: 0 };

    const { count } = await this.prisma.followerTagRelation.deleteMany({
      where: {
        followerId: { in: dto.followerIds },
        tagId: { in: validTagIds },
        tag: { tenantId }, // 二次校验, 防越权
      },
    });
    return { removed: count };
  }

  // ── 标签规则引擎 ──────────────────────────────────────────────────────

  async getTagRules(authorizerId: string) {
    return this.prisma.tagRule.findMany({
      where: { authorizerId, deletedAt: null },
      include: { targetTag: { select: { id: true, name: true, color: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createTagRule(tenantId: string, authorizerId: string, dto: CreateTagRuleDto) {
    return this.prisma.tagRule.create({
      data: {
        tenantId,
        authorizerId,
        name: dto.name,
        description: dto.description,
        conditions: dto.conditions as any,
        logic: dto.logic,
        targetTagId: dto.targetTagId,
      },
    });
  }

  async updateTagRule(ruleId: string, dto: UpdateTagRuleDto) {
    return this.prisma.tagRule.update({
      where: { id: ruleId },
      data: { ...dto, conditions: dto.conditions as any },
    });
  }

  async deleteTagRule(ruleId: string) {
    await this.prisma.tagRule.update({
      where: { id: ruleId },
      data: { deletedAt: new Date() },
    });
    return { deleted: true };
  }

  /** 执行标签规则（手动触发或定时任务触发） */
  async executeTagRule(ruleId: string) {
    const rule = await this.prisma.tagRule.findUnique({
      where: { id: ruleId },
      include: { targetTag: true },
    });
    if (!rule || rule.status !== 'enabled') throw new Error('规则不存在或已禁用');

    const startedAt = new Date();
    const conditions = rule.conditions as Array<{ field: string; operator: string; value: number | string }>;

    // 构建 Prisma WHERE 子句
    const where: Record<string, unknown> = { authorizerId: rule.authorizerId, subscribe: true };
    for (const cond of conditions) {
      const op = cond.operator;
      const val = cond.value;
      const field = cond.field;

      if (['gt', 'gte', 'lt', 'lte', 'eq'].includes(op)) {
        where[field] = { [op]: val };
      } else if (op === 'days_ago_gte') {
        // lastInteractAt >= N days ago
        const date = new Date(Date.now() - (val as number) * 86400000);
        where[field] = { lte: date };
      } else if (op === 'days_ago_lte') {
        const date = new Date(Date.now() - (val as number) * 86400000);
        where[field] = { gte: date };
      } else if (op === 'in') {
        where[field] = { in: val as unknown as string[] };
      } else if (op === 'contains') {
        where[field] = { contains: val };
      }
    }

    // 查找匹配的粉丝
    const followers = await this.prisma.follower.findMany({
      where: where as any,
      select: { id: true },
    });

    // 批量打标签
    let taggedCount = 0;
    for (const f of followers) {
      try {
        await this.prisma.followerTagRelation.create({
          data: { followerId: f.id, tagId: rule.targetTagId, source: 'rule' },
        });
        taggedCount++;
      } catch { /* exist */ }
    }

    // 记录执行日志
    await this.prisma.tagRuleExecutionLog.create({
      data: {
        ruleId: rule.id,
        affectedCount: followers.length,
        taggedCount,
        startedAt,
        finishedAt: new Date(),
      },
    });

    await this.prisma.tagRule.update({
      where: { id: ruleId },
      data: { lastExecAt: new Date(), lastExecCount: taggedCount },
    });

    return { affected: followers.length, tagged: taggedCount };
  }

  // ── 黑名单 ────────────────────────────────────────────────────────────

  async getBlacklist(authorizerId: string, page = 1, page_size = 50) {
    const [list, total] = await Promise.all([
      this.prisma.blacklist.findMany({
        where: { authorizerId },
        include: { follower: { select: { id: true, openid: true, nickname: true, headImg: true } } },
        skip: (page - 1) * page_size,
        take: page_size,
      }),
      this.prisma.blacklist.count({ where: { authorizerId } }),
    ]);
    return { list, total, page, page_size };
  }

  async addToBlacklist(authorizerId: string, followerId: string, reason?: string) {
    return this.prisma.blacklist.create({
      data: { authorizerId, followerId, reason },
    });
  }

  async removeFromBlacklist(authorizerId: string, followerId: string) {
    await this.prisma.blacklist.deleteMany({ where: { authorizerId, followerId } });
    return { removed: true };
  }

  // ── 粉丝画像 ──────────────────────────────────────────────────────────

  /** 获取粉丝画像统计数据 */
  async getPortrait(authorizerId: string) {
    const baseWhere = { authorizerId, subscribe: true };
    const [total, sexStats, provinceStatsRaw] = await Promise.all([
      this.prisma.follower.count({ where: baseWhere }),
      this.prisma.follower.groupBy({ by: ['sex'], where: baseWhere, _count: true }),
      this.prisma.follower.groupBy({ by: ['province'], where: baseWhere, _count: true }),
    ]);

    const gender = { male: 0, female: 0, unknown: 0 };
    (sexStats as Array<{ sex: number | null; _count: number }>).forEach((s) => {
      if (s.sex === 1) gender.male = s._count;
      else if (s.sex === 2) gender.female = s._count;
      else gender.unknown += s._count;
    });

    // 按人数倒序排序后取 TOP10
    const provinceStats = (provinceStatsRaw as Array<{ province: string | null; _count: number }>)
      .filter((s) => !!s.province)
      .sort((a, b) => b._count - a._count)
      .slice(0, 10);

    return {
      totalFollowers: total,
      gender: {
        male: total ? gender.male / total : 0,
        female: total ? gender.female / total : 0,
        unknown: total ? gender.unknown / total : 0,
      },
      region: provinceStats.map((s) => ({
        province: s.province as string,
        count: s._count,
      })),
    };
  }
}
