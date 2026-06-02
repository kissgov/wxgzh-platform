// TagRuleProcessor — 定时执行自动标签规则
// ============================================================================
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { recordQueueJob } from './metrics-wrapper';

@Processor('tag-rule')
export class TagRuleProcessor extends WorkerHost {
  private readonly logger = new Logger(TagRuleProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<{ ruleId: string }>): Promise<{ affected: number; tagged: number }> {
    const { ruleId } = job.data;
    const start = process.hrtime.bigint();
    try {
      const result = await this.executeTagRule(ruleId, start);
      recordQueueJob('tag-rule', 'completed', start);
      return result;
    } catch (err) {
      recordQueueJob('tag-rule', 'failed', start);
      throw err;
    }
  }

  private async executeTagRule(ruleId: string, start: bigint) {
    const rule = await this.prisma.tagRule.findUnique({
      where: { id: ruleId },
      include: { targetTag: true },
    });

    if (!rule || rule.status !== 'enabled') {
      throw new Error('Rule not found or disabled');
    }

    const startedAt = new Date();
    const conditions = rule.conditions as Array<{
      field: string; operator: string; value: number | string;
    }>;

    const where: Record<string, unknown> = {
      authorizerId: rule.authorizerId,
      subscribe: true,
    };

    for (const cond of conditions) {
      const { field, operator: op, value: val } = cond;
      if (['gt', 'gte', 'lt', 'lte', 'eq'].includes(op)) {
        where[field] = { [op]: val };
      } else if (op === 'days_ago_gte') {
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

    const followers = await this.prisma.follower.findMany({
      where: where as any,
      select: { id: true },
    });

    let taggedCount = 0;
    for (const f of followers) {
      try {
        await this.prisma.followerTagRelation.create({
          data: { followerId: f.id, tagId: rule.targetTagId, source: 'rule' },
        });
        taggedCount++;
      } catch { /* 已存在 */ }
    }

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

    this.logger.log(
      `Tag rule "${rule.name}" executed: ${taggedCount} tagged / ${followers.length} affected`,
    );

    return { affected: followers.length, tagged: taggedCount };
  }

  /** 定时任务：执行所有启用的标签规则 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async scheduleAllRules(): Promise<any[]> {
    const rules = await this.prisma.tagRule.findMany({
      where: { status: 'enabled', deletedAt: null },
      select: { id: true },
    });

    const results: any[] = [];
    for (const rule of rules) {
      try {
        const result = await this.process({
          data: { ruleId: rule.id },
        } as Job<{ ruleId: string }>);
        results.push({ ruleId: rule.id, ...result, status: 'success' });
      } catch (err) {
        results.push({
          ruleId: rule.id,
          status: 'failed',
          error: (err as Error).message,
        });
      }
    }

    return results;
  }
}
