// PaymentService — 支付订单 + 订阅激活 + Mock 支付
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  constructor(private readonly prisma: PrismaService) {}

  /** 创建支付订单 */
  async createOrder(tenantId: string, dto: { plan: string; period: string; method: string }) {
    if (dto.plan === 'free') throw new BadRequestException('免费套餐无需订阅');

    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { slug: dto.plan } });
    if (!plan) throw new NotFoundException('套餐不存在');

    // 检查是否已是完全相同的套餐且未过期
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (tenant?.plan === dto.plan && tenant?.billingPeriod === dto.period) {
      const notExpired = !tenant.subscriptionExpiresAt || tenant.subscriptionExpiresAt > new Date();
      if (notExpired) throw new BadRequestException('您已订阅该套餐且未过期，无需重复订阅');
    }

    // 套餐升降级检测
    const planOrder: Record<string, number> = { free: 0, starter: 1, pro: 2, enterprise: 3 };
    const currentLevel = planOrder[tenant?.plan || 'free'] ?? 0;
    const newLevel = planOrder[dto.plan] ?? 0;
    const isUpgrade = newLevel > currentLevel;
    const isDowngrade = newLevel < currentLevel;
    const isSwitchPeriod = newLevel === currentLevel && dto.plan !== (tenant?.plan || 'free');

    const priceKey = dto.period === 'monthly' ? 'priceMonthly' : dto.period === 'quarterly' ? 'priceQuarterly' : 'priceYearly';
    const amount = (plan as any)[priceKey] || plan.priceMonthly;

    const config = await this.prisma.paymentConfig.findUnique({ where: { tenantId } });
    const channel = config?.channel || 'mock';
    const isMock = channel === 'mock';
    const autoSuccess = isMock && config?.mockSuccess !== false;

    const tradeNo = `PAY_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    const order = await this.prisma.paymentOrder.create({
      data: {
        tenantId, plan: dto.plan, period: dto.period, amount,
        method: dto.method || 'scan',
        status: 'pending',
        tradeNo,
        qrCodeUrl: `/pay/${tradeNo}`,
      },
    });

    const result: any = { ...order, isUpgrade, isDowngrade, isSwitchPeriod };

    this.logger.log(`Order created: ${order.id} plan=${dto.plan} amount=${amount} status=${order.status} upgrade=${isUpgrade} downgrade=${isDowngrade}`);
    return result;
  }

  /** 激活订阅 */
  async activateSubscription(tenantId: string, orderId: string, opts?: { isUpgrade?: boolean; isDowngrade?: boolean }) {
    const order = await this.prisma.paymentOrder.findFirst({ where: { id: orderId, tenantId } });
    if (!order || order.status !== 'paid') throw new BadRequestException('订单未支付');

    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { slug: order.plan } });
    if (!plan) throw new NotFoundException('套餐不存在');

    // 将旧订阅记录标记为已取消
    if (opts?.isUpgrade || opts?.isDowngrade) {
      await this.prisma.subscriptionRecord.updateMany({
        where: { tenantId, status: 'active' },
        data: { status: 'cancelled' },
      });
    }

    // Calculate expiry
    const now = new Date();
    let expiresAt: Date | null = null;
    if (order.period === 'monthly') expiresAt = new Date(now.getTime() + 30 * 86400000);
    else if (order.period === 'quarterly') expiresAt = new Date(now.getTime() + 90 * 86400000);
    else if (order.period === 'yearly') expiresAt = new Date(now.getTime() + 365 * 86400000);
    else if (order.period === 'permanent') expiresAt = null;

    // Create subscription record
    await this.prisma.subscriptionRecord.create({
      data: { tenantId, plan: order.plan, period: order.period, amount: order.amount, startedAt: now, expiresAt, status: 'active' },
    });

    // Update tenant
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        plan: order.plan, billingPeriod: order.period,
        maxAuthorizers: plan.maxAuthorizers, maxUsers: plan.maxUsers,
        subscriptionExpiresAt: expiresAt, trialEndsAt: null,
      },
    });

    this.logger.log(`Subscription activated: tenant=${tenantId} plan=${order.plan} expires=${expiresAt} ${opts?.isUpgrade ? 'UPGRADE' : opts?.isDowngrade ? 'DOWNGRADE' : 'NEW'}`);
  }

  /** 支付回调处理 */
  async handleCallback(tradeNo: string, success: boolean) {
    if (!tradeNo) return;
    await this.prisma.paymentOrder.updateMany({
      where: { tradeNo, status: 'pending' },
      data: { status: success ? 'paid' : 'cancelled', paidAt: success ? new Date() : null },
    });
    if (success) {
      const order = await this.prisma.paymentOrder.findFirst({ where: { tradeNo } });
      if (order) await this.activateSubscription(order.tenantId, order.id);
    }
  }

  /** 获取订单列表 */
  async getOrders(tenantId: string, query: { page?: number; page_size?: number } = {}) {
    const { page = 1, page_size = 20 } = query;
    const [list, total] = await Promise.all([
      this.prisma.paymentOrder.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * page_size, take: page_size }),
      this.prisma.paymentOrder.count({ where: { tenantId } }),
    ]);
    return { list, total, page, page_size };
  }

  /** 获取套餐列表 */
  async getPlans() { return this.prisma.subscriptionPlan.findMany({ where: { status: 'active' }, orderBy: { sortOrder: 'asc' } }); }

  /** 更新套餐 */
  async upsertPlan(dto: any) {
    return this.prisma.subscriptionPlan.upsert({ where: { slug: dto.slug }, create: dto, update: dto });
  }

  /** 获取/更新支付配置 */
  async getPaymentConfig(tenantId: string) {
    const config = await this.prisma.paymentConfig.findUnique({ where: { tenantId } });
    return config || { mode: 'mock', mockSuccess: true, wechatAppId: null, wechatMchId: null, alipayAppId: null };
  }

  async upsertPaymentConfig(tenantId: string, dto: any) {
    const clean = (v: any) => (v === '' ? null : v);
    const data = {
      channel: clean(dto.channel) || 'mock',
      mockSuccess: dto.mockSuccess,
      // 官方直连 — 微信
      wechatAppId: clean(dto.wechatAppId), wechatMchId: clean(dto.wechatMchId),
      wechatApiKey: clean(dto.wechatApiKey), wechatCertPath: clean(dto.wechatCertPath),
      // 官方直连 — 支付宝
      alipayAppId: clean(dto.alipayAppId), alipayPid: clean(dto.alipayPid),
      alipayPrivateKey: clean(dto.alipayPrivateKey), alipayPublicKey: clean(dto.alipayPublicKey),
      // 第三方网关
      thirdpartyGateway: clean(dto.thirdpartyGateway),
      thirdpartyAppId: clean(dto.thirdpartyAppId), thirdpartyAppKey: clean(dto.thirdpartyAppKey),
      thirdpartyApiUrl: clean(dto.thirdpartyApiUrl), thirdpartyNotifyUrl: clean(dto.thirdpartyNotifyUrl),
    };
    return this.prisma.paymentConfig.upsert({
      where: { tenantId },
      create: { tenantId, ...data },
      update: data,
    });
  }
}
