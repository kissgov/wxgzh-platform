// PaymentController — 用户支付 + Admin 配置
import { Controller, Get, Post, Put, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantId, RequireRoles, Public } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/security/require-permission.decorator';
import { PERMISSIONS } from '../../common/security/permissions';
import { PaymentService } from './payment.service';

@ApiTags('支付订阅')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  // ── 用户端 ──────────────────────────────────────────────────────

  @Get('payment/plans')
  @RequirePermission(PERMISSIONS.BILLING_READ)
  @ApiOperation({ summary: '套餐列表' })
  async listPlans() { const data = await this.paymentService.getPlans(); return { code: 0, message: '成功', data }; }

  @Post('payment/orders')
  @RequirePermission(PERMISSIONS.BILLING_WRITE)
  @ApiOperation({ summary: '创建支付订单' })
  async createOrder(@TenantId() tenantId: string, @Body() body: { plan: string; period: string; method: string }) {
    try {
      const data = await this.paymentService.createOrder(tenantId, body);
      return { code: 0, message: data.status === 'paid' ? '支付成功，订阅已激活' : '订单已创建，请完成支付', data };
    } catch (e: any) { return { code: 10005, message: e.message, data: null }; }
  }

  @Get('payment/orders')
  @RequirePermission(PERMISSIONS.BILLING_READ)
  @ApiOperation({ summary: '支付订单列表' })
  async listOrders(@TenantId() tenantId: string, @Query('page') page?: number) {
    const data = await this.paymentService.getOrders(tenantId, { page });
    return { code: 0, message: '成功', data };
  }

  // ── Admin 配置 ─────────────────────────────────────────────────

  @Get('admin/payment-config')
  @RequireRoles('super_admin')
  @RequirePermission(PERMISSIONS.PLATFORM_ADMIN)
  @ApiOperation({ summary: '获取支付配置 [管理员]' })
  async getConfig(@TenantId() tenantId: string) {
    const data = await this.paymentService.getPaymentConfig(tenantId);
    return { code: 0, message: '成功', data };
  }

  @Put('admin/payment-config')
  @RequireRoles('super_admin')
  @RequirePermission(PERMISSIONS.PLATFORM_ADMIN)
  @ApiOperation({ summary: '更新支付配置 [管理员]' })
  async updateConfig(@TenantId() tenantId: string, @Body() body: any) {
    const data = await this.paymentService.upsertPaymentConfig(tenantId, body);
    return { code: 0, message: '配置已保存', data };
  }

  @Get('admin/plans')
  @RequireRoles('super_admin')
  @RequirePermission(PERMISSIONS.PLATFORM_ADMIN)
  @ApiOperation({ summary: '套餐列表 [管理员]' })
  async adminPlans() { const data = await this.paymentService.getPlans(); return { code: 0, message: '成功', data }; }

  @Put('admin/plans/:slug')
  @RequireRoles('super_admin')
  @RequirePermission(PERMISSIONS.PLATFORM_ADMIN)
  @ApiOperation({ summary: '更新套餐 [管理员]' })
  async updatePlan(@Param('slug') slug: string, @Body() body: any) {
    const data = await this.paymentService.upsertPlan({ ...body, slug });
    return { code: 0, message: '套餐已更新', data };
  }

  // ── Admin 租户管理 ──────────────────────────────────────────────

  @Get('admin/tenants')
  @RequireRoles('super_admin')
  @RequirePermission(PERMISSIONS.PLATFORM_ADMIN)
  @ApiOperation({ summary: '租户列表 [超管]' })
  async adminTenants() {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    try {
      const tenants = await prisma.tenant.findMany({
        where: { deletedAt: null },
        include: { _count: { select: { users: true, authorizers: true } } },
        orderBy: { createdAt: 'desc' },
      });
      return { code: 0, message: '成功', data: { list: tenants, total: tenants.length, page: 1, page_size: 100 } };
    } finally { await prisma.$disconnect(); }
  }

  @Put('admin/tenants/:id')
  @RequireRoles('super_admin')
  @RequirePermission(PERMISSIONS.PLATFORM_ADMIN)
  @ApiOperation({ summary: '更新租户 [超管]' })
  async adminUpdateTenant(@Param('id') id: string, @Body() body: any) {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    try {
      await prisma.tenant.update({ where: { id }, data: body });
      return { code: 0, message: '已更新', data: null };
    } finally { await prisma.$disconnect(); }
  }

  @Post('admin/tenants/:id/subscribe')
  @RequireRoles('super_admin')
  @RequirePermission(PERMISSIONS.PLATFORM_ADMIN)
  @ApiOperation({ summary: '手动订阅 [超管]' })
  async adminSubscribeTenant(@Param('id') id: string, @Body() body: any) {
    // Create a paid order and activate subscription manually
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    try {
      const plan = await prisma.subscriptionPlan.findUnique({ where: { slug: body.plan } });
      const amount = (plan as any)?.[body.period === 'monthly' ? 'priceMonthly' : 'priceYearly'] || 0;
      const order = await prisma.paymentOrder.create({
        data: { tenantId: id, plan: body.plan, period: body.period || 'monthly', amount, method: 'manual', status: 'paid', paidAt: new Date(), tradeNo: `ADMIN_${Date.now()}` },
      });
      await this.paymentService.activateSubscription(id, order.id);
      return { code: 0, message: '订阅已激活', data: order };
    } finally { await prisma.$disconnect(); }
  }

  @Get('admin/payment-orders')
  @RequireRoles('super_admin')
  @RequirePermission(PERMISSIONS.PLATFORM_ADMIN)
  @ApiOperation({ summary: '全部支付订单 [超管]' })
  async adminPaymentOrders(@Query('page') page?: number) {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    try {
      const p = page || 1;
      const [list, total] = await Promise.all([
        prisma.paymentOrder.findMany({ orderBy: { createdAt: 'desc' }, skip: (p - 1) * 20, take: 20, include: { tenant: { select: { id: true, name: true } } } }).then(list => list.map(o => ({ ...o, tenantName: o.tenant?.name || '-' }))),
        prisma.paymentOrder.count(),
      ]);
      return { code: 0, message: '成功', data: { list, total, page: p, page_size: 20 } };
    } finally { await prisma.$disconnect(); }
  }

  @Post('admin/payment-orders/:id/confirm')
  @RequireRoles('super_admin')
  @RequirePermission(PERMISSIONS.PLATFORM_ADMIN)
  @ApiOperation({ summary: '手动确认收款 [超管]' })
  async adminConfirmPayment(@Param('id') id: string) {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    try {
      const order = await prisma.paymentOrder.update({ where: { id }, data: { status: 'paid', paidAt: new Date() } });
      await this.paymentService.activateSubscription(order.tenantId, order.id);
      return { code: 0, message: '收款已确认，订阅已激活', data: order };
    } finally { await prisma.$disconnect(); }
  }

  // ── 支付完成 (模拟扫码) ──────────────────────────────────────

  @Public()
  @Post('payment/pay/:tradeNo/complete')
  @ApiOperation({ summary: '完成支付 (扫码后回调)' })
  async completePayment(@Param('tradeNo') tradeNo: string) {
    await this.paymentService.handleCallback(tradeNo, true);
    return { code: 0, message: '支付成功', data: null };
  }

  // ── 支付回调 (公开) ───────────────────────────────────────────

  @Public()
  @Post('payment/callback/:method')
  @ApiOperation({ summary: '支付回调 (微信/支付宝)' })
  async paymentCallback(@Param('method') method: string, @Body() body: any) {
    const tradeNo = body.out_trade_no || body.trade_no;
    await this.paymentService.handleCallback(tradeNo, body.result_code === 'SUCCESS' || body.trade_status === 'TRADE_SUCCESS');
    return { code: 'SUCCESS', message: 'OK' };
  }
}
