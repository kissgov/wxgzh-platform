// PaymentService 单元测试 — 订单创建 / 回调激活订阅 / 跨租户隔离
// ============================================================================
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrisma: any = {
  tenant: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  subscriptionPlan: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    upsert: jest.fn(),
  },
  paymentOrder: {
    create: jest.fn(),
    updateMany: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  paymentConfig: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  subscriptionRecord: {
    create: jest.fn(),
    updateMany: jest.fn(),
  },
};

describe('PaymentService', () => {
  let service: PaymentService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<PaymentService>(PaymentService);
  });

  // ── createOrder (含 plan/period/amount) ──────────────────────────

  describe('createOrder (mock channel, upgrade detection)', () => {
    it('should compute amount from plan, generate tradeNo, and detect upgrade', async () => {
      // 当前租户在 free 套餐, 升到 pro
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 't1', plan: 'free', billingPeriod: null, subscriptionExpiresAt: null,
      });
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue({
        id: 'p-pro', slug: 'pro', maxAuthorizers: 5, maxUsers: 20,
        priceMonthly: 99, priceQuarterly: 269, priceYearly: 999,
      });
      mockPrisma.paymentConfig.findUnique.mockResolvedValue({ channel: 'mock', mockSuccess: true });
      mockPrisma.paymentOrder.create.mockResolvedValue({
        id: 'order-1', tenantId: 't1', plan: 'pro', period: 'monthly',
        amount: 99, status: 'pending', tradeNo: 'PAY_X', qrCodeUrl: '/pay/PAY_X',
      });

      const result = await service.createOrder('t1', {
        plan: 'pro', period: 'monthly', method: 'scan',
      });

      // 1. 金额取自 priceMonthly
      expect(result.amount).toBe(99);
      expect(result.plan).toBe('pro');
      // 2. 升级检测: free(0) → pro(2) = upgrade
      expect(result.isUpgrade).toBe(true);
      expect(result.isDowngrade).toBe(false);
      expect(result.isSwitchPeriod).toBe(false);
      // 3. paymentOrder.create 必含 tenantId + plan + period + amount + status=pending
      const createCall = mockPrisma.paymentOrder.create.mock.calls[0][0];
      expect(createCall.data.tenantId).toBe('t1');
      expect(createCall.data.plan).toBe('pro');
      expect(createCall.data.period).toBe('monthly');
      expect(createCall.data.amount).toBe(99);
      expect(createCall.data.status).toBe('pending');
      // tradeNo 必带 PAY_ 前缀
      expect(createCall.data.tradeNo).toMatch(/^PAY_/);
      expect(createCall.data.qrCodeUrl).toContain('/pay/');
    });

    it('should reject free plan and duplicate active subscription', async () => {
      // free 套餐
      await expect(
        service.createOrder('t1', { plan: 'free', period: 'monthly', method: 'scan' }),
      ).rejects.toThrow(BadRequestException);

      // 已订阅同套餐未过期
      const future = new Date(Date.now() + 30 * 86400000);
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 't1', plan: 'pro', billingPeriod: 'monthly', subscriptionExpiresAt: future,
      });
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue({
        id: 'p-pro', slug: 'pro', priceMonthly: 99,
      });

      await expect(
        service.createOrder('t1', { plan: 'pro', period: 'monthly', method: 'scan' }),
      ).rejects.toThrow(/已订阅/);
    });

    it('should throw NotFoundException when plan not found', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: 't1', plan: 'free' });
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(null);

      await expect(
        service.createOrder('t1', { plan: 'unknown', period: 'monthly', method: 'scan' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── handleCallback (订单状态更新 + 订阅激活) ────────────────────

  describe('handleCallback (Wechat-style notify)', () => {
    it('should update order to paid and activate subscription for tenant', async () => {
      mockPrisma.paymentOrder.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.paymentOrder.findFirst.mockResolvedValue({
        id: 'order-1', tenantId: 't1', plan: 'pro', period: 'monthly', amount: 99, status: 'paid',
      });
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue({
        id: 'p-pro', slug: 'pro', maxAuthorizers: 5, maxUsers: 20, priceMonthly: 99,
      });
      mockPrisma.subscriptionRecord.create.mockResolvedValue({});
      mockPrisma.tenant.update.mockResolvedValue({});

      await service.handleCallback('PAY_TRADE_X', true);

      // 1. updateMany 必传 tradeNo + status=pending → paid, paidAt 必填
      const updCall = mockPrisma.paymentOrder.updateMany.mock.calls[0][0];
      expect(updCall.where.tradeNo).toBe('PAY_TRADE_X');
      expect(updCall.where.status).toBe('pending');
      expect(updCall.data.status).toBe('paid');
      expect(updCall.data.paidAt).toBeInstanceOf(Date);

      // 2. 创建 subscriptionRecord (status=active)
      const subRec = mockPrisma.subscriptionRecord.create.mock.calls[0][0];
      expect(subRec.data.tenantId).toBe('t1');
      expect(subRec.data.plan).toBe('pro');
      expect(subRec.data.period).toBe('monthly');
      expect(subRec.data.status).toBe('active');
      // 30 天后到期 (monthly)
      expect(subRec.data.expiresAt).toBeInstanceOf(Date);

      // 3. 租户 plan 升级
      const tenantUpd = mockPrisma.tenant.update.mock.calls[0][0];
      expect(tenantUpd.where.id).toBe('t1');
      expect(tenantUpd.data.plan).toBe('pro');
      expect(tenantUpd.data.billingPeriod).toBe('monthly');
      expect(tenantUpd.data.maxAuthorizers).toBe(5);
      expect(tenantUpd.data.maxUsers).toBe(20);
    });

    it('should mark order as cancelled when success=false', async () => {
      mockPrisma.paymentOrder.updateMany.mockResolvedValue({ count: 1 });

      await service.handleCallback('PAY_FAIL', false);

      const updCall = mockPrisma.paymentOrder.updateMany.mock.calls[0][0];
      expect(updCall.data.status).toBe('cancelled');
      expect(updCall.data.paidAt).toBeNull();
      // 不应激活订阅
      expect(mockPrisma.subscriptionRecord.create).not.toHaveBeenCalled();
      expect(mockPrisma.tenant.update).not.toHaveBeenCalled();
    });

    it('should noop when tradeNo empty', async () => {
      await service.handleCallback('', true);
      expect(mockPrisma.paymentOrder.updateMany).not.toHaveBeenCalled();
    });
  });

  // ── getOrders 跨租户隔离 ─────────────────────────────────────────

  describe('getOrders (tenant isolation)', () => {
    it('should only return orders belonging to the requested tenant', async () => {
      mockPrisma.paymentOrder.findMany.mockResolvedValue([
        { id: 'o1', tenantId: 't1', plan: 'pro', amount: 99 },
        { id: 'o2', tenantId: 't1', plan: 'starter', amount: 29 },
      ]);
      mockPrisma.paymentOrder.count.mockResolvedValue(2);

      const result = await service.getOrders('t1', { page: 1, page_size: 20 });

      expect(result.list).toHaveLength(2);
      // 关键: findMany.where.tenantId 必须是 't1', 否则越权泄漏
      const findCall = mockPrisma.paymentOrder.findMany.mock.calls[0][0];
      expect(findCall.where.tenantId).toBe('t1');
      // count 也必须带 tenantId
      const countCall = mockPrisma.paymentOrder.count.mock.calls[0][0];
      expect(countCall.where.tenantId).toBe('t1');
      // 分页
      expect(findCall.skip).toBe(0);
      expect(findCall.take).toBe(20);
    });
  });

  // ── activateSubscription 升降级路径 ──────────────────────────────

  describe('activateSubscription (upgrade path)', () => {
    it('should cancel old active records before activating new one when isUpgrade=true', async () => {
      mockPrisma.paymentOrder.findFirst.mockResolvedValue({
        id: 'o1', tenantId: 't1', plan: 'pro', period: 'monthly', amount: 99, status: 'paid',
      });
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue({
        id: 'p-pro', slug: 'pro', maxAuthorizers: 5, maxUsers: 20, priceMonthly: 99,
      });
      mockPrisma.subscriptionRecord.updateMany.mockResolvedValue({});
      mockPrisma.subscriptionRecord.create.mockResolvedValue({});
      mockPrisma.tenant.update.mockResolvedValue({});

      await service.activateSubscription('t1', 'o1', { isUpgrade: true });

      // 1. 升级路径必先取消旧订阅
      const cancelCall = mockPrisma.subscriptionRecord.updateMany.mock.calls[0][0];
      expect(cancelCall.where.tenantId).toBe('t1');
      expect(cancelCall.where.status).toBe('active');
      expect(cancelCall.data.status).toBe('cancelled');
      // 2. 创建新订阅记录
      expect(mockPrisma.subscriptionRecord.create).toHaveBeenCalled();
    });

    it('should reject activation when order not paid', async () => {
      mockPrisma.paymentOrder.findFirst.mockResolvedValue({
        id: 'o1', tenantId: 't1', status: 'pending',
      });

      await expect(service.activateSubscription('t1', 'o1'))
        .rejects.toThrow(BadRequestException);

      expect(mockPrisma.subscriptionRecord.create).not.toHaveBeenCalled();
    });
  });
});
