// SchedulerService — 定时任务调度（Cron 连线）
// 将已有的 Processor 方法连接到 @Cron 装饰器
// ============================================================================
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { TokenRefreshProcessor } from './token-refresh.processor';
import { TagRuleProcessor } from './tag-rule.processor';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly tokenRefreshProcessor: TokenRefreshProcessor,
    private readonly tagRuleProcessor: TagRuleProcessor,
    @InjectQueue('sync-data') private readonly syncDataQueue: Queue,
  ) {}

  /** Token 刷新扫描 — 每 5 分钟 */
  @Cron('*/5 * * * *')
  async handleTokenRefresh() {
    this.logger.log('Scheduled: Token refresh scan');
    try {
      const results = await this.tokenRefreshProcessor.scheduleRefresh();
      const succeeded = results.filter((r: any) => r.status === 'refreshed').length;
      const failed = results.filter((r: any) => r.status === 'failed').length;
      if (results.length > 0) {
        this.logger.log(`Token refresh done: ${succeeded} OK, ${failed} failed out of ${results.length}`);
      }
    } catch (err) {
      this.logger.error(`Token refresh scan failed: ${(err as Error).message}`);
    }
  }

  /** 标签规则执行 — 每 1 小时 */
  @Cron('0 */1 * * *')
  async handleTagRuleExecution() {
    this.logger.log('Scheduled: Tag rule execution');
    try {
      await this.tagRuleProcessor.scheduleAllRules();
    } catch (err) {
      this.logger.error(`Tag rule execution failed: ${(err as Error).message}`);
    }
  }

  /** 数据同步 — 粉丝每 6 小时 */
  @Cron('0 */6 * * *')
  async handleFollowerSync() {
    this.logger.log('Scheduled: Follower data sync');
    try {
      // 获取所有活跃授权公众号并入队
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      try {
        const authorizers = await prisma.authorizer.findMany({
          where: { status: 'authorized', deletedAt: null },
          select: { id: true, tenantId: true },
        });
        for (const auth of authorizers) {
          await this.syncDataQueue.add('sync-followers', {
            taskType: 'follower_sync',
            tenantId: auth.tenantId,
            authorizerId: auth.id,
          });
        }
        this.logger.log(`Queued follower sync for ${authorizers.length} authorizers`);
      } finally {
        await prisma.$disconnect();
      }
    } catch (err) {
      this.logger.error(`Follower sync scheduling failed: ${(err as Error).message}`);
    }
  }

  /** 数据统计同步 — 每日凌晨 1:00 */
  @Cron('0 1 * * *')
  async handleDailyStatsSync() {
    this.logger.log('Scheduled: Daily stats sync');
    try {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      try {
        const authorizers = await prisma.authorizer.findMany({
          where: { status: 'authorized', deletedAt: null },
          select: { id: true, tenantId: true },
        });
        for (const auth of authorizers) {
          await this.syncDataQueue.add('sync-stats', {
            taskType: 'user_analysis',
            tenantId: auth.tenantId,
            authorizerId: auth.id,
          });
          await this.syncDataQueue.add('sync-stats', {
            taskType: 'msg_analysis',
            tenantId: auth.tenantId,
            authorizerId: auth.id,
          });
          await this.syncDataQueue.add('sync-stats', {
            taskType: 'news_analysis',
            tenantId: auth.tenantId,
            authorizerId: auth.id,
          });
        }
        this.logger.log(`Queued daily stats sync for ${authorizers.length} authorizers`);
      } finally {
        await prisma.$disconnect();
      }
    } catch (err) {
      this.logger.error(`Daily stats sync scheduling failed: ${(err as Error).message}`);
    }
  }
}
