// Analytics Service — 数据统计
// ============================================================================
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /** 粉丝趋势（每日） */
  async getFollowerTrend(authorizerId: string, startDate: string, endDate: string) {
    const stats = await this.prisma.followerStat.findMany({
      where: {
        authorizerId,
        statDate: { gte: new Date(startDate), lte: new Date(endDate) },
      },
      orderBy: { statDate: 'asc' },
    });

    const summary = stats.reduce(
      (acc: any, s: any) => ({
        totalFollowers: s.totalFollowers,
        newSubscribers: acc.newSubscribers + s.newSubscribers,
        unsubscribers: acc.unsubscribers + s.unsubscribers,
        netGrowth: acc.netGrowth + s.netGrowth,
      }),
      { totalFollowers: 0, newSubscribers: 0, unsubscribers: 0, netGrowth: 0 },
    );

    return {
      summary,
      series: stats.map((s: any) => ({
        date: s.statDate.toISOString().split('T')[0],
        newSubs: s.newSubscribers,
        unsubs: s.unsubscribers,
        net: s.netGrowth,
        total: s.totalFollowers,
      })),
    };
  }

  /** 消息交互趋势 */
  async getMessageTrend(authorizerId: string, startDate: string, endDate: string) {
    const stats = await this.prisma.messageStat.findMany({
      where: {
        authorizerId,
        statDate: { gte: new Date(startDate), lte: new Date(endDate) },
      },
      orderBy: { statDate: 'asc' },
    });

    const summary = stats.reduce(
      (acc: any, s: any) => ({
        sent: acc.sent + s.sentCount,
        received: acc.received + s.receivedCount,
        replied: acc.replied + s.replyCount,
      }),
      { sent: 0, received: 0, replied: 0 },
    );

    const replyRate = summary.received > 0
      ? (summary.replied / summary.received)
      : 0;

    return {
      summary: { ...summary, replyRate },
      series: stats.map((s: any) => ({
        date: s.statDate.toISOString().split('T')[0],
        sent: s.sentCount,
        received: s.receivedCount,
        replied: s.replyCount,
        replyRate: s.replyRate || 0,
      })),
    };
  }

  /** 图文分析 */
  async getNewsAnalysis(authorizerId: string, startDate: string, endDate: string, page = 1, page_size = 20) {
    const where = {
      authorizerId,
      statDate: { gte: new Date(startDate), lte: new Date(endDate) },
    };

    const [list, total] = await Promise.all([
      this.prisma.newsStat.findMany({
        where,
        orderBy: { readCount: 'desc' },
        skip: (page - 1) * page_size,
        take: page_size,
      }),
      this.prisma.newsStat.count({ where }),
    ]);

    return { list, total, page, page_size };
  }

  /** 看板概览数据 */
  async getOverview(authorizerId: string) {
    const now = new Date();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

    const [totalFollowers, recentFollowers, recentMessages] = await Promise.all([
      this.prisma.follower.count({
        where: { authorizerId, subscribe: true, deletedAt: null },
      }),
      this.prisma.followerStat.aggregate({
        where: { authorizerId, statDate: { gte: thirtyDaysAgo } },
        _sum: { newSubscribers: true, unsubscribers: true },
      }),
      this.prisma.messageStat.aggregate({
        where: { authorizerId, statDate: { gte: thirtyDaysAgo } },
        _sum: { sentCount: true, receivedCount: true, replyCount: true },
      }),
    ]);

    return {
      totalFollowers,
      last30Days: {
        newSubscribers: recentFollowers._sum.newSubscribers || 0,
        unsubscribers: recentFollowers._sum.unsubscribers || 0,
        netGrowth: (recentFollowers._sum.newSubscribers || 0) - (recentFollowers._sum.unsubscribers || 0),
      },
      messages: {
        sent: recentMessages._sum.sentCount || 0,
        received: recentMessages._sum.receivedCount || 0,
      },
    };
  }

  // ── 转化漏斗 ────────────────────────────────────────────────────

  async getFunnels(tenantId: string, authorizerId: string) {
    return this.prisma.conversionFunnel.findMany({
      where: { tenantId, authorizerId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createFunnel(tenantId: string, authorizerId: string, dto: { name: string; description?: string; steps: any[] }) {
    return this.prisma.conversionFunnel.create({
      data: { tenantId, authorizerId, name: dto.name, description: dto.description, steps: dto.steps as any },
    });
  }

  async getFunnelData(tenantId: string, funnelId: string) {
    const funnel = await this.prisma.conversionFunnel.findFirst({
      where: { id: funnelId, tenantId, deletedAt: null },
    });
    if (!funnel) return null;

    const steps = funnel.steps as Array<{ key: string; label: string; eventType: string }>;
    const data = [];
    let prev = 0;

    for (const step of steps) {
      const count = await this.prisma.followerEvent.count({
        where: { authorizerId: funnel.authorizerId, eventType: step.eventType },
      });
      data.push({
        name: step.label,
        value: count,
        rate: prev > 0 ? ((count / prev) * 100).toFixed(1) + '%' : '100%',
      });
      prev = count;
    }
    return { funnel, data };
  }

  // ── RFM 分析 ─────────────────────────────────────────────────────

  async getRfmOverview(authorizerId: string) {
    const segments = await this.prisma.rfmSegment.groupBy({
      by: ['segment'],
      where: { authorizerId },
      _count: true,
    });
    const labels: Record<string, string> = {
      champions: '核心用户', loyal: '忠诚用户', potential: '潜力用户',
      at_risk: '流失风险', lost: '已流失',
    };
    return segments.map((s: any) => ({
      segment: s.segment,
      label: labels[s.segment] || s.segment,
      count: s._count,
    }));
  }

  async computeRfm(authorizerId: string) {
    const logger = new Logger('RFM');
    const followers = await this.prisma.follower.findMany({
      where: { authorizerId, subscribe: true },
      select: { id: true, interactCount: true, lastInteractAt: true },
    });
    if (!followers.length) return { processed: 0 };

    // Quick percentile-based scoring (simplified for MVP)
    const sortedByRecency = followers.map(f => ({ ...f, days: f.lastInteractAt ? Math.floor((Date.now() - f.lastInteractAt.getTime()) / 86400000) : 999 }));
    sortedByRecency.sort((a, b) => a.days - b.days);
    const sortedByFreq = [...followers].sort((a, b) => b.interactCount - a.interactCount);
    const n = followers.length;

    for (let i = 0; i < n; i++) {
      const f = followers[i]!;
      const rScore = Math.ceil(((sortedByRecency.findIndex(x => x.id === f.id) + 1) / n) * 5);
      const fScore = Math.ceil(((sortedByFreq.findIndex(x => x.id === f.id) + 1) / n) * 5);
      const mScore = fScore; // MVP: monetary proxy = frequency
      const avgScore = (rScore + fScore + mScore) / 3;

      let segment = 'lost';
      if (avgScore >= 4) segment = 'champions';
      else if (avgScore >= 3) segment = 'loyal';
      else if (avgScore >= 2.5) segment = 'potential';
      else if (avgScore >= 1.5) segment = 'at_risk';

      await this.prisma.rfmSegment.upsert({
        where: { followerId: f.id },
        create: { authorizerId, followerId: f.id, recencyScore: rScore, frequencyScore: fScore, monetaryScore: mScore, segment, segmentLabel: '' },
        update: { recencyScore: rScore, frequencyScore: fScore, monetaryScore: mScore, segment, segmentLabel: '', calculatedAt: new Date() },
      });
    }
    logger.log(`RFM computed for ${authorizerId}: ${n} followers`);
    return { processed: n };
  }
}
