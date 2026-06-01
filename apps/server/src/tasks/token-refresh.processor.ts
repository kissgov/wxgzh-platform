// TokenRefreshProcessor — 定时刷新 authorizer_access_token
// ============================================================================
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { WechatService } from '../integrations/wechat/wechat.service';

@Processor('token-refresh')
export class TokenRefreshProcessor extends WorkerHost {
  private readonly logger = new Logger(TokenRefreshProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wechatService: WechatService,
  ) {
    super();
  }

  async process(job: Job<{ authorizerId: string }>): Promise<void> {
    const { authorizerId } = job.data;
    try {
      await this.wechatService.refreshAuthorizerToken(authorizerId);
      this.logger.log(`Token refreshed for authorizer: ${authorizerId}`);
    } catch (err) {
      this.logger.error(`Token refresh failed for ${authorizerId}: ${(err as Error).message}`);
      throw err; // BullMQ 将自动重试
    }
  }

  /** 定时任务：扫描即将过期的 Token 并入队刷新 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async scheduleRefresh(): Promise<any[]> {
    const now = new Date();
    const threshold = new Date(now.getTime() + 300_000); // 5 分钟内过期

    const authorizers = await this.prisma.authorizer.findMany({
      where: {
        status: 'authorized',
        tokenExpireAt: { lte: threshold },
        deletedAt: null,
      },
      select: { id: true },
    });

    this.logger.log(`Scheduling token refresh for ${authorizers.length} authorizers`);

    const results: any[] = [];
    for (const auth of authorizers) {
      try {
        // 直接刷新（不走队列以减少延迟）
        await this.wechatService.refreshAuthorizerToken(auth.id);
        results.push({ authorizerId: auth.id, status: 'refreshed' });
      } catch (err) {
        results.push({
          authorizerId: auth.id,
          status: 'failed',
          error: (err as Error).message,
        });
      }
    }

    return results;
  }
}
