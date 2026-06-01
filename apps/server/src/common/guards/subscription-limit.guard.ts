// 订阅限制守卫 — 校验租户是否超出套餐限制
// ============================================================================
import {
  Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SubscriptionLimitGuard implements CanActivate {
  private readonly logger = new Logger(SubscriptionLimitGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const tenantId = request.user?.tenantId;
    const method = request.method;
    const path = request.route?.path || request.url;

    if (!tenantId) return true; // 公开端点不检查

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        plan: true, status: true, maxAuthorizers: true, maxUsers: true,
        subscriptionExpiresAt: true, billingPeriod: true, trialEndsAt: true,
      },
    });

    if (!tenant) return true;
    if (tenant.status !== 'active') {
      throw new ForbiddenException('租户已被冻结，请联系管理员');
    }

    // 检查订阅是否过期（免费套餐永久有效）
    if (tenant.plan !== 'free' && tenant.billingPeriod !== 'trial' && tenant.billingPeriod !== 'permanent') {
      if (tenant.subscriptionExpiresAt && new Date() > tenant.subscriptionExpiresAt) {
        throw new ForbiddenException('订阅已过期，请续费后重试');
      }
    }

    // 检查试用期
    if (tenant.billingPeriod === 'trial' && tenant.trialEndsAt && new Date() > tenant.trialEndsAt) {
      throw new ForbiddenException('试用已到期，请选择套餐后继续使用');
    }

    // 拦截创建公众号的操作，检查 maxAuthorizers
    if (method === 'POST' && (path.includes('/accounts/groups') || path.includes('/platform/auth-url'))) {
      const authorizerCount = await this.prisma.authorizer.count({
        where: { tenantId, status: 'authorized', deletedAt: null },
      });
      if (tenant.maxAuthorizers && authorizerCount >= tenant.maxAuthorizers) {
        throw new ForbiddenException(
          `已达公众号数量上限（${tenant.maxAuthorizers}），请升级套餐或移除不用的公众号`,
        );
      }
    }

    // 拦截创建用户操作，检查 maxUsers
    if (method === 'POST' && path.includes('/users')) {
      const userCount = await this.prisma.user.count({
        where: { tenantId, deletedAt: null },
      });
      if (tenant.maxUsers && userCount >= tenant.maxUsers) {
        throw new ForbiddenException(
          `已达用户数量上限（${tenant.maxUsers}），请升级套餐或移除不用的用户`,
        );
      }
    }

    return true;
  }
}
