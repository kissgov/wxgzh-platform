// Message Service — 消息管理核心业务逻辑
// ============================================================================
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { businessEventsTotal } from '../../common/observability/metrics';
import type { MessageLogQueryDto, CreateAutoReplyDto, CreateBroadcastDto } from './message.dto';

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── 消息日志查询 ────────────────────────────────────────────────────

  async getMessageLogs(
    authorizerId: string,
    query: MessageLogQueryDto,
  ) {
    const { page = 1, page_size = 50, direction, msgType, keyword } = query;
    const where: Record<string, unknown> = { authorizerId };

    if (direction) where['direction'] = direction;
    if (msgType) where['msgType'] = msgType;
    if (keyword) where['content'] = { contains: keyword };

    const [list, total] = await Promise.all([
      this.prisma.messageLog.findMany({
        where: where as any,
        include: {
          follower: { select: { id: true, nickname: true, headImg: true, openid: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * page_size,
        take: page_size,
      }),
      this.prisma.messageLog.count({ where: where as any }),
    ]);

    return { list, total, page, page_size };
  }

  // ── 自动回复规则 ────────────────────────────────────────────────────

  async getAutoReplyRules(authorizerId: string, ruleType?: string) {
    const where: Record<string, unknown> = { authorizerId, deletedAt: null };
    if (ruleType) where['ruleType'] = ruleType;

    return this.prisma.autoReplyRule.findMany({
      where: where as any,
      include: {
        keywordReplies: true,
        replyContents: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async createAutoReplyRule(
    tenantId: string,
    authorizerId: string,
    dto: CreateAutoReplyDto,
  ) {
    const rule = await this.prisma.autoReplyRule.create({
      data: {
        tenantId,
        authorizerId,
        ruleType: dto.ruleType,
        name: dto.name,
        status: dto.status || 'enabled',
        keywordReplies: dto.keywordReplies
          ? { create: dto.keywordReplies.map((k) => ({ matchType: k.matchType, keyword: k.keyword })) }
          : undefined,
        replyContents: {
          create: dto.replyContents.map((r, i) => ({
            contentType: r.contentType,
            content: r.content,
            sortOrder: r.sortOrder ?? i,
          })),
        },
      },
      include: { keywordReplies: true, replyContents: true },
    });
    this.logger.log(`Auto-reply rule created: ${rule.name}`);
    return rule;
  }

  async updateAutoReplyRule(ruleId: string, dto: Partial<CreateAutoReplyDto>) {
    // 先删除旧的 keywordReplies 和 replyContents，再重建
    if (dto.keywordReplies || dto.replyContents) {
      await this.prisma.$transaction([
        this.prisma.keywordReply.deleteMany({ where: { ruleId } }),
        this.prisma.replyContent.deleteMany({ where: { ruleId } }),
      ]);
    }

    return this.prisma.autoReplyRule.update({
      where: { id: ruleId },
      data: {
        name: dto.name,
        status: dto.status,
        ruleType: dto.ruleType,
        keywordReplies: dto.keywordReplies
          ? { create: dto.keywordReplies.map((k) => ({ matchType: k.matchType, keyword: k.keyword })) }
          : undefined,
        replyContents: dto.replyContents
          ? { create: dto.replyContents.map((r, i) => ({ contentType: r.contentType, content: r.content, sortOrder: r.sortOrder ?? i })) }
          : undefined,
      },
      include: { keywordReplies: true, replyContents: true },
    });
  }

  async deleteAutoReplyRule(ruleId: string) {
    await this.prisma.autoReplyRule.update({
      where: { id: ruleId },
      data: { deletedAt: new Date() },
    });
    return { deleted: true };
  }

  async toggleAutoReplyRule(ruleId: string) {
    const rule = await this.prisma.autoReplyRule.findUnique({ where: { id: ruleId } });
    if (!rule) throw new NotFoundException('规则不存在');
    return this.prisma.autoReplyRule.update({
      where: { id: ruleId },
      data: { status: rule.status === 'enabled' ? 'disabled' : 'enabled' },
    });
  }

  /**
   * 关键词匹配引擎
   * 优先级: 精确匹配 → 模糊匹配 → 正则匹配 → 默认回复
   */
  async matchKeywordReply(authorizerId: string, keyword: string) {
    const rules = await this.prisma.autoReplyRule.findMany({
      where: {
        authorizerId,
        ruleType: 'keyword',
        status: 'enabled',
        deletedAt: null,
      },
      include: { keywordReplies: true, replyContents: true },
      orderBy: { priority: 'desc' },
    });

    // 1. 精确匹配
    for (const rule of rules) {
      const match = rule.keywordReplies.find(
        (kr: any) => kr.matchType === 'exact' && kr.keyword === keyword,
      );
      if (match) {
        businessEventsTotal.inc({ event: 'auto_reply_triggered', tenant_id: rule.tenantId });
        return rule;
      }
    }

    // 2. 模糊匹配
    for (const rule of rules) {
      const match = rule.keywordReplies.find(
        (kr: any) => kr.matchType === 'fuzzy' && keyword.includes(kr.keyword),
      );
      if (match) {
        businessEventsTotal.inc({ event: 'auto_reply_triggered', tenant_id: rule.tenantId });
        return rule;
      }
    }

    // 3. 正则匹配
    for (const rule of rules) {
      const match = rule.keywordReplies.find((kr: any) => {
        if (kr.matchType !== 'regex') return false;
        try {
          return new RegExp(kr.keyword).test(keyword);
        } catch {
          return false;
        }
      });
      if (match) {
        businessEventsTotal.inc({ event: 'auto_reply_triggered', tenant_id: rule.tenantId });
        return rule;
      }
    }

    // 4. 默认回复
    const defaultRule = await this.prisma.autoReplyRule.findFirst({
      where: {
        authorizerId,
        ruleType: 'default',
        status: 'enabled',
        deletedAt: null,
      },
      include: { replyContents: true },
    });
    if (defaultRule) {
      businessEventsTotal.inc({ event: 'auto_reply_triggered', tenant_id: defaultRule.tenantId });
      return defaultRule;
    }

    // 5. AI 智能回复兜底
    return null; // 由 Controller 层调用 AI 回复
  }

  // ── 消息群发 ────────────────────────────────────────────────────────

  async createBroadcast(
    tenantId: string,
    authorizerId: string,
    dto: CreateBroadcastDto,
  ) {
    return this.prisma.broadcastMessage.create({
      data: {
        tenantId,
        authorizerId,
        msgType: dto.msgType,
        content: dto.content as any,
        targetType: dto.targetType || 'all',
        targetConfig: dto.targetConfig as any,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        status: dto.scheduledAt ? 'pending' : 'draft',
      },
    });
  }

  async getBroadcasts(query: { authorizerId: string; page?: number; page_size?: number }) {
    const { authorizerId, page = 1, page_size = 20 } = query;
    const [list, total] = await Promise.all([
      this.prisma.broadcastMessage.findMany({
        where: { authorizerId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * page_size,
        take: page_size,
      }),
      this.prisma.broadcastMessage.count({
        where: { authorizerId, deletedAt: null },
      }),
    ]);
    return { list, total, page, page_size };
  }

  /** 发送群发消息（标记为 pending，由 Worker 异步执行实际发送） */
  async sendBroadcast(id: string) {
    const updated = await this.prisma.broadcastMessage.update({
      where: { id },
      data: { status: 'pending', sentAt: new Date() },
    });
    businessEventsTotal.inc({ event: 'message_sent', tenant_id: updated.tenantId });
    return updated;
  }

  /** 查询发送进度 */
  async getBroadcastProgress(id: string) {
    return this.prisma.broadcastMessage.findUnique({
      where: { id },
      select: {
        id: true, status: true, sentCount: true, errorCount: true,
      },
    });
  }
}
