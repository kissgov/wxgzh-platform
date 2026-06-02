// PaymentController — 用户支付 + Admin 配置
import { Controller, Get, Post, Put, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantId, RequireRoles, Public } from '../../common/decorators/current-user.decorator';
import { ZodBody } from '../../common/decorators/zod-body.decorator';
import { ZodResponse } from '../../common/decorators/zod-response.decorator';
import { PaymentService } from './payment.service';
import {
  CreateOrderInputSchema,
  UpdatePaymentConfigInputSchema,
  UpdatePlanInputSchema,
  AdminUpdateTenantInputSchema,
  AdminSubscribeTenantInputSchema,
  NotifyInputSchema,
  ListPlansOutputSchema,
  CreateOrderOutputSchema,
  ListOrdersOutputSchema,
  GetPaymentConfigOutputSchema,
  UpdatePaymentConfigOutputSchema,
  UpdatePlanOutputSchema,
  ListAdminTenantsOutputSchema,
  ListAdminPaymentOrdersOutputSchema,
  AdminSubscribeTenantOutputSchema,
  AdminConfirmPaymentOutputSchema,
  NotifyOutputSchema,
  VoidResponseSchema,
  type CreateOrderInput,
  type UpdatePaymentConfigInput,
  type UpdatePlanInput,
  type AdminUpdateTenantInput,
  type AdminSubscribeTenantInput,
  type NotifyInput,
} from '../../common/contracts/payment.contract';

@ApiTags('支付订阅')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  // ── 用户端 ──────────────────────────────────────────────────────

  @Get('payment/plans')
  @ApiOperation({ summary: '套餐列表' })
  @ZodResponse(ListPlansOutputSchema)
  async listPlans() { const data = await this.paymentService.getPlans(); return { code: 0, message: '成功', data }; }

  @Post('payment/orders')
  @ApiOperation({ summary: '创建支付订单' })
  @ZodResponse(CreateOrderOutputSchema)
  async createOrder(@TenantId() tenantId: string, @ZodBody(CreateOrderInputSchema) input: CreateOrderInput) {
    try {
      const data = await this.paymentService.createOrder(tenantId, input);
      return { code: 0, message: data.status === 'paid' ? '支付成功，订阅已激活' : '订单已创建，请完成支付', data };
    } catch (e: any) { return { code: 10005, message: e.message, data: null }; }
  }

  @Get('payment/orders')
  @ApiOperation({ summary: '支付订单列表' })
  @ZodResponse(ListOrdersOutputSchema)
  async listOrders(@TenantId() tenantId: string, @Query('page') page?: number) {
    const data = await this.paymentService.getOrders(tenantId, { page });
    return { code: 0, message: '成功', data };
  }

  // ── Admin 配置 ─────────────────────────────────────────────────

  @Get('admin/payment-config')
  @RequireRoles('super_admin')
  @ApiOperation({ summary: '获取支付配置 [管理员]' })
  @ZodResponse(GetPaymentConfigOutputSchema)
  async getConfig(@TenantId() tenantId: string) {
    const data = await this.paymentService.getPaymentConfig(tenantId);
    return { code: 0, message: '成功', data };
  }

  @Put('admin/payment-config')
  @RequireRoles('super_admin')
  @ApiOperation({ summary: '更新支付配置 [管理员]' })
  @ZodResponse(UpdatePaymentConfigOutputSchema)
  async updateConfig(@TenantId() tenantId: string, @ZodBody(UpdatePaymentConfigInputSchema) input: UpdatePaymentConfigInput) {
    const data = await this.paymentService.upsertPaymentConfig(tenantId, input);
    return { code: 0, message: '配置已保存', data };
  }

  @Get('admin/plans')
  @RequireRoles('super_admin')
  @ApiOperation({ summary: '套餐列表 [管理员]' })
  @ZodResponse(ListPlansOutputSchema)
  async adminPlans() { const data = await this.paymentService.getPlans(); return { code: 0, message: '成功', data }; }

  @Put('admin/plans/:slug')
  @RequireRoles('super_admin')
  @ApiOperation({ summary: '更新套餐 [管理员]' })
  @ZodResponse(UpdatePlanOutputSchema)
  async updatePlan(@Param('slug') slug: string, @ZodBody(UpdatePlanInputSchema) input: UpdatePlanInput) {
    const data = await this.paymentService.upsertPlan({ ...input, slug });
    return { code: 0, message: '套餐已更新', data };
  }

  // ── Admin 租户管理 ──────────────────────────────────────────────

  @Get('admin/tenants')
  @RequireRoles('super_admin')
  @ApiOperation({ summary: '租户列表 [超管]' })
  @ZodResponse(ListAdminTenantsOutputSchema)
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
  @ApiOperation({ summary: '更新租户 [超管]' })
  @ZodResponse(VoidResponseSchema)
  async adminUpdateTenant(@Param('id') id: string, @ZodBody(AdminUpdateTenantInputSchema) input: AdminUpdateTenantInput) {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    try {
      await prisma.tenant.update({ where: { id }, data: input });
      return { code: 0, message: '已更新', data: null };
    } finally { await prisma.$disconnect(); }
  }

  @Post('admin/tenants/:id/subscribe')
  @RequireRoles('super_admin')
  @ApiOperation({ summary: '手动订阅 [超管]' })
  @ZodResponse(AdminSubscribeTenantOutputSchema)
  async adminSubscribeTenant(@Param('id') id: string, @ZodBody(AdminSubscribeTenantInputSchema) input: AdminSubscribeTenantInput) {
    // Create a paid order and activate subscription manually
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    try {
      const plan = await prisma.subscriptionPlan.findUnique({ where: { slug: input.plan } });
      const amount = (plan as any)?.[input.period === 'monthly' ? 'priceMonthly' : 'priceYearly'] || 0;
      const order = await prisma.paymentOrder.create({
        data: { tenantId: id, plan: input.plan, period: input.period || 'monthly', amount, method: 'manual', status: 'paid', paidAt: new Date(), tradeNo: `ADMIN_${Date.now()}` },
      });
      await this.paymentService.activateSubscription(id, order.id);
      return { code: 0, message: '订阅已激活', data: order };
    } finally { await prisma.$disconnect(); }
  }

  @Get('admin/payment-orders')
  @RequireRoles('super_admin')
  @ApiOperation({ summary: '全部支付订单 [超管]' })
  @ZodResponse(ListAdminPaymentOrdersOutputSchema)
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
  @ApiOperation({ summary: '手动确认收款 [超管]' })
  @ZodResponse(AdminConfirmPaymentOutputSchema)
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
  @ZodResponse(VoidResponseSchema)
  async completePayment(@Param('tradeNo') tradeNo: string) {
    await this.paymentService.handleCallback(tradeNo, true);
    return { code: 0, message: '支付成功', data: null };
  }

  // ── 支付回调 (公开) ───────────────────────────────────────────

  @Public()
  @Post('payment/callback/:method')
  @ApiOperation({ summary: '支付回调 (微信/支付宝)' })
  @ZodResponse(NotifyOutputSchema)
  async paymentCallback(@Param('method') method: string, @ZodBody(NotifyInputSchema) input: NotifyInput) {
    const tradeNo = (input.out_trade_no as string) || (input.trade_no as string);
    await this.paymentService.handleCallback(tradeNo, input.result_code === 'SUCCESS' || input.trade_status === 'TRADE_SUCCESS');
    return { code: 'SUCCESS', message: 'OK' };
  }
}
