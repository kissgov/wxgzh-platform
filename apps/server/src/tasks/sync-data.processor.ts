// SyncDataProcessor — 异步同步微信数据（粉丝/统计/素材）
// ============================================================================
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { WechatService } from '../integrations/wechat/wechat.service';
import { recordQueueJob } from './metrics-wrapper';

// ── 日期工具 ───────────────────────────────────────────────────────

const toDateStr = (d: Date): string => d.toISOString().split('T')[0]!;
const todayStr = (): string => toDateStr(new Date());
const daysAgoStr = (n: number): string => toDateStr(new Date(Date.now() - n * 86400000));

export interface SyncDataJob {
  taskType: 'follower_sync' | 'user_analysis' | 'news_analysis' | 'msg_analysis';
  tenantId: string;
  authorizerId: string;
}

@Processor('sync-data')
export class SyncDataProcessor extends WorkerHost {
  private readonly logger = new Logger(SyncDataProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wechatService: WechatService,
  ) {
    super();
  }

  async process(job: Job<SyncDataJob>): Promise<void> {
    const { taskType, tenantId, authorizerId } = job.data;
    const start = process.hrtime.bigint();

    const syncTask = await this.prisma.syncTask.create({
      data: {
        tenantId,
        authorizerId,
        taskType,
        status: 'running',
        startedAt: new Date(),
        params: job.data as any,
      },
    });

    try {
      switch (taskType) {
        case 'follower_sync':
          await this.syncFollowers(authorizerId, tenantId);
          break;
        case 'user_analysis':
          await this.syncUserAnalysis(authorizerId);
          break;
        case 'news_analysis':
          await this.syncNewsAnalysis(authorizerId);
          break;
        case 'msg_analysis':
          await this.syncMessageAnalysis(authorizerId);
          break;
      }

      await this.prisma.syncTask.update({
        where: { id: syncTask.id },
        data: { status: 'success', finishedAt: new Date() },
      });
      recordQueueJob('sync-data', 'completed', start);
      this.logger.log(`Sync OK: ${taskType} for ${authorizerId}`);
    } catch (err) {
      recordQueueJob('sync-data', 'failed', start);
      this.logger.error(`Sync FAIL: ${taskType} for ${authorizerId}: ${(err as Error).message}`);
      await this.prisma.syncTask.update({
        where: { id: syncTask.id },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          errorMessage: (err as Error).message.substring(0, 500),
        },
      });
      throw err;
    }
  }

  // ── 粉丝同步 ─────────────────────────────────────────────────────

  private async syncFollowers(authorizerId: string, tenantId: string): Promise<void> {
    this.logger.log(`Syncing followers for ${authorizerId}`);
    let nextOpenid: string | undefined;
    let totalSynced = 0;
    const MAX_PAGES = 200;

    for (let i = 0; i < MAX_PAGES; i++) {
      const result = await this.wechatService.getFollowers(authorizerId, nextOpenid);
      const openids = result?.data?.openid;
      if (!openids?.length) break;

      for (let j = 0; j < openids.length; j += 100) {
        const batch = openids.slice(j, j + 100);
        const infoResult = await this.wechatService.batchGetUserInfo(authorizerId, batch);
        for (const user of infoResult.user_info_list || []) {
          try {
            await this.prisma.follower.upsert({
              where: { authorizerId_openid: { authorizerId, openid: user.openid } },
              create: {
                tenantId,
                authorizerId,
                openid: user.openid,
                unionid: user.unionid || null,
                nickname: user.nickname,
                headImg: user.headimgurl,
                sex: user.sex,
                country: user.country,
                province: user.province,
                city: user.city,
                subscribe: user.subscribe === 1,
                subscribeAt: user.subscribe_time ? new Date(user.subscribe_time * 1000) : null,
                subscribeScene: user.subscribe_scene || null,
                qrScene: user.qr_scene ? String(user.qr_scene) : null,
                qrSceneStr: user.qr_scene_str || null,
                remark: user.remark || null,
                syncedAt: new Date(),
              },
              update: {
                nickname: user.nickname,
                headImg: user.headimgurl,
                sex: user.sex,
                country: user.country,
                province: user.province,
                city: user.city,
                subscribe: user.subscribe === 1,
                syncedAt: new Date(),
              },
            });
            totalSynced++;
          } catch {
            // 重复或无效记录，跳过
          }
        }
      }

      nextOpenid = result?.next_openid;
      if (!nextOpenid) break;
    }

    this.logger.log(`Follower sync done: ${totalSynced} for ${authorizerId}`);
  }

  // ── 用户分析（T+1） ───────────────────────────────────────────────

  private async syncUserAnalysis(authorizerId: string): Promise<void> {
    const beginDate = daysAgoStr(30);
    const endDate = daysAgoStr(1);
    this.logger.log(`Syncing user analysis ${beginDate}~${endDate} for ${authorizerId}`);

    try {
      const summary = await this.wechatService.getUserSummary(authorizerId, beginDate, endDate);
      if (summary.list) {
        for (const item of summary.list) {
          await this.prisma.followerStat.upsert({
            where: {
              authorizerId_statDate: {
                authorizerId,
                statDate: new Date(item.ref_date),
              },
            },
            create: {
              authorizerId,
              statDate: new Date(item.ref_date),
              newSubscribers: item.new_user || 0,
              unsubscribers: item.cancel_user || 0,
              netGrowth: (item.new_user || 0) - (item.cancel_user || 0),
              sourceData: { user_source: item.user_source } as any,
            },
            update: {
              newSubscribers: item.new_user || 0,
              unsubscribers: item.cancel_user || 0,
              netGrowth: (item.new_user || 0) - (item.cancel_user || 0),
            },
          });
        }
      }

      const cumulate = await this.wechatService.getUserCumulate(authorizerId, beginDate, endDate);
      if (cumulate.list) {
        for (const item of cumulate.list) {
          await this.prisma.followerStat.updateMany({
            where: {
              authorizerId,
              statDate: new Date(item.ref_date),
            },
            data: { totalFollowers: item.cumulate_user || 0 },
          });
        }
      }
      this.logger.log(`User analysis sync OK for ${authorizerId}`);
    } catch (err) {
      this.logger.warn(`User analysis sync skipped (可能无权限): ${(err as Error).message}`);
    }
  }

  // ── 图文分析 ─────────────────────────────────────────────────────

  private async syncNewsAnalysis(authorizerId: string): Promise<void> {
    const beginDate = daysAgoStr(7);
    const endDate = daysAgoStr(1);
    this.logger.log(`Syncing news analysis ${beginDate}~${endDate} for ${authorizerId}`);

    try {
      const summary = await this.wechatService.getArticleSummary(authorizerId, beginDate, endDate);
      if (summary.list) {
        for (const item of summary.list) {
          const statDate = new Date(item.ref_date);
          const existing = await this.prisma.newsStat.findFirst({
            where: { authorizerId, statDate, msgid: item.msgid },
          });

          if (existing) {
            await this.prisma.newsStat.update({
              where: { id: existing.id },
              data: {
                readCount: (item.int_page_read_count || 0) + (item.ori_page_read_count || 0),
                likeCount: item.add_to_fav_count || 0,
                shareCount: item.share_count || 0,
              },
            });
          } else {
            await this.prisma.newsStat.create({
              data: {
                authorizerId,
                statDate,
                msgid: item.msgid,
                title: item.title,
                readCount: (item.int_page_read_count || 0) + (item.ori_page_read_count || 0),
                likeCount: item.add_to_fav_count || 0,
                favorCount: item.add_to_fav_count || 0,
                shareCount: item.share_count || 0,
                readSourceData: {
                  session: item.int_page_from_session_read_user || 0,
                  history: item.int_page_from_hist_msg_read_user || 0,
                  feed: item.int_page_from_feed_read_user || 0,
                  friends: item.int_page_from_friends_read_user || 0,
                  other: item.int_page_from_other_read_user || 0,
                } as any,
              },
            });
          }
        }
      }
      this.logger.log(`News analysis sync OK: ${summary.list?.length || 0} articles for ${authorizerId}`);
    } catch (err) {
      this.logger.warn(`News analysis sync skipped: ${(err as Error).message}`);
    }
  }

  // ── 消息分析 ─────────────────────────────────────────────────────

  private async syncMessageAnalysis(authorizerId: string): Promise<void> {
    const beginDate = daysAgoStr(30);
    const endDate = daysAgoStr(1);
    this.logger.log(`Syncing message analysis ${beginDate}~${endDate} for ${authorizerId}`);

    try {
      const upstream = await this.wechatService.getUpstreamMsg(authorizerId, beginDate, endDate);
      if (upstream.list) {
        const dateMap = new Map<string, { sent: number; received: number }>();
        for (const item of upstream.list) {
          const entry = dateMap.get(item.ref_date) || { sent: 0, received: 0 };
          // msg_type 1=text 2=image 3=voice 4=video 6=link — all counted as received
          entry.received += item.msg_count || 0;
          dateMap.set(item.ref_date, entry);
        }

        for (const [date, stats] of dateMap) {
          const statDate = new Date(date);
          await this.prisma.messageStat.upsert({
            where: { authorizerId_statDate: { authorizerId, statDate } },
            create: {
              authorizerId,
              statDate,
              sentCount: stats.sent,
              receivedCount: stats.received,
              replyCount: 0,
              replyRate: 0,
            },
            update: {
              receivedCount: stats.received,
              sentCount: stats.sent,
            },
          });
        }
      }
      this.logger.log(`Message analysis sync OK for ${authorizerId}`);
    } catch (err) {
      this.logger.warn(`Message analysis sync skipped: ${(err as Error).message}`);
    }
  }
}
