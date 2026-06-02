// PlatformService 单元测试 — ComponentApp 配置 + Authorizer 越权防护
// ============================================================================
// 重点:
//   - handleTicketReceived / upsertComponentApp 走纯 prisma 路径, 用 mock 测
//   - handleAuthorizationSucceeded / generateAuthUrl 调微信 API + Redis,
//     需要更深 stub, 这里只覆盖 prisma 边界 + 越权防护
// ============================================================================
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PlatformService } from './platform.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WechatService } from '../../integrations/wechat/wechat.service';

// Mock Prisma (PlatformService 涉及的 model)
const mockPrisma: any = {
  componentApp: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  authorizer: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
  },
  authEvent: { create: jest.fn() },
  auditLog: { create: jest.fn() },
};

// Mock WechatService (不实际调 API)
const mockWechatService: any = {
  requestComponent: jest.fn(),
  refreshComponentToken: jest.fn().mockResolvedValue('mock_token'),
  setTicket: jest.fn(),
};

// Mock EventEmitter2
const mockEventEmitter: any = { emit: jest.fn() };

describe('PlatformService', () => {
  let service: PlatformService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: WechatService, useValue: mockWechatService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();
    service = module.get<PlatformService>(PlatformService);
    // 关掉 ioredis 真实连接 (PlatformService 构造里 new Redis)
    // service 上有 redis 私有属性, 关闭它
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc: any = service;
    if (svc.redis && typeof svc.redis.disconnect === 'function') {
      svc.redis.disconnect();
    }
  });

  afterAll(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc: any = service;
    if (svc.redis && typeof svc.redis.disconnect === 'function') {
      svc.redis.disconnect();
    }
  });

  // ── getComponentAppConfig ──────────────────────────────────────────

  describe('getComponentAppConfig', () => {
    it('should mask appSecret and encodingAesKey when returning config', async () => {
      mockPrisma.componentApp.findFirst.mockResolvedValue({
        id: 'c1',
        appId: 'wx-test-app',
        appSecret: 'secret_abcdefgh_xyz',
        token: 'plain-token',
        encodingAesKey: 'aes_abcdefgh_xyz_key',
        verifyTicket: 'ticket-xxx',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.getComponentAppConfig();

      expect(result).not.toBeNull();
      expect(result!.appId).toBe('wx-test-app');
      // secret 脱敏: 含 **** 且不含完整明文
      expect(result!.appSecret).toMatch(/\*/);
      expect(result!.appSecret).not.toBe('secret_abcdefgh_xyz');
      // token 明文返回 (设计如此)
      expect(result!.token).toBe('plain-token');
      // hasVerifyTicket 反映 ticket 存在
      expect(result!.hasVerifyTicket).toBe(true);
    });

    it('should return null when no active component app', async () => {
      mockPrisma.componentApp.findFirst.mockResolvedValue(null);

      const result = await service.getComponentAppConfig();

      expect(result).toBeNull();
    });
  });

  // ── upsertComponentApp ─────────────────────────────────────────────

  describe('upsertComponentApp', () => {
    it('should create new component app when no active one exists', async () => {
      mockPrisma.componentApp.findFirst.mockResolvedValue(null);
      const createdRow = {
        id: 'c-new',
        appId: 'wx-new-app',
        appSecret: 'new_secret_long_value',
        token: 't-new',
        encodingAesKey: 'aes_new_key_long_value',
        verifyTicket: null,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.componentApp.create.mockResolvedValue(createdRow);

      const result = await service.upsertComponentApp({
        appId: 'wx-new-app',
        appSecret: 'new_secret_long_value',
        token: 't-new',
        encodingAesKey: 'aes_new_key_long_value',
      });

      expect(result.id).toBe('c-new');
      expect(result.appId).toBe('wx-new-app');
      // 新建时没有 ticket
      expect(result.hasVerifyTicket).toBe(false);
      // secret 脱敏
      expect(result.appSecret).toMatch(/\*/);
      expect(mockPrisma.componentApp.create).toHaveBeenCalled();
      expect(mockPrisma.componentApp.update).not.toHaveBeenCalled();
    });

    it('should update existing component app when active one found', async () => {
      mockPrisma.componentApp.findFirst.mockResolvedValue({ id: 'c1' });
      mockPrisma.componentApp.update.mockResolvedValue({
        id: 'c1',
        appId: 'wx-updated',
        appSecret: 'updated_secret_xxxxxxxx',
        token: 'updated-tok',
        encodingAesKey: 'updated_aes_xxxxxxxxx',
        verifyTicket: 'existing-ticket',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.upsertComponentApp({
        appId: 'wx-updated',
        appSecret: 'updated_secret_xxxxxxxx',
        token: 'updated-tok',
        encodingAesKey: 'updated_aes_xxxxxxxxx',
      });

      expect(result.appId).toBe('wx-updated');
      expect(result.hasVerifyTicket).toBe(true);
      expect(mockPrisma.componentApp.update).toHaveBeenCalled();
      expect(mockPrisma.componentApp.create).not.toHaveBeenCalled();
    });
  });

  // ── handleTicketReceived ───────────────────────────────────────────

  describe('handleTicketReceived', () => {
    it('should store ticket to componentApp row and emit event', async () => {
      const dbRow = { id: 'c1', appId: 'wx-test-app', verifyTicket: null };
      mockPrisma.componentApp.findUnique.mockResolvedValue(dbRow);
      mockPrisma.componentApp.update.mockResolvedValue({ ...dbRow, verifyTicket: 'new-ticket-xxx' });

      await service.handleTicketReceived('wx-test-app', 'new-ticket-xxx');

      expect(mockPrisma.componentApp.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { verifyTicket: 'new-ticket-xxx' },
      });
      // 触发 token 刷新
      expect(mockWechatService.refreshComponentToken).toHaveBeenCalledWith('c1');
      // 触发事件
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'platform.ticket.received',
        { componentAppId: 'c1' },
      );
    });

    it('should silently no-op when componentApp not found', async () => {
      mockPrisma.componentApp.findUnique.mockResolvedValue(null);

      await service.handleTicketReceived('wx-missing', 'ticket-xxx');

      expect(mockPrisma.componentApp.update).not.toHaveBeenCalled();
      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  // ── getAuthorizerDetail 越权防护 ────────────────────────────────────

  describe('getAuthorizerDetail', () => {
    it('should throw NotFoundException when authorizer belongs to other tenant', async () => {
      mockPrisma.authorizer.findFirst.mockResolvedValue(null);

      await expect(
        service.getAuthorizerDetail('tenant-A', 'authorizer-of-tenant-B'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should strip accessToken/refreshToken from returned detail', async () => {
      mockPrisma.authorizer.findFirst.mockResolvedValue({
        id: 'a1',
        tenantId: 't1',
        appId: 'wx-a1',
        nickName: 'Test MP',
        accessToken: 'SECRET_TOKEN',
        refreshToken: 'SECRET_REFRESH',
        deletedAt: null,
      });

      const result = await service.getAuthorizerDetail('t1', 'a1');

      // 越权: findFirst 必须带 tenantId 过滤
      expect(mockPrisma.authorizer.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'a1', tenantId: 't1', deletedAt: null }),
        }),
      );
      // token 字段不返回
      expect((result as any).accessToken).toBeUndefined();
      expect((result as any).refreshToken).toBeUndefined();
      expect(result.nickName).toBe('Test MP');
    });
  });

  // ── handleAuthorizationRevoked ─────────────────────────────────────

  describe('handleAuthorizationRevoked', () => {
    it('should mark authorizer as revoked and emit event', async () => {
      mockPrisma.authorizer.findUnique.mockResolvedValue({
        id: 'a1', appId: 'wx-a1', status: 'authorized',
      });
      mockPrisma.authorizer.update.mockResolvedValue({});

      await service.handleAuthorizationRevoked('wx-a1');

      expect(mockPrisma.authorizer.update).toHaveBeenCalledWith({
        where: { id: 'a1' },
        data: { status: 'revoked' },
      });
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'authorizer.revoked',
        expect.objectContaining({ authorizerId: 'a1', appId: 'wx-a1' }),
      );
    });

    it('should no-op when authorizer not found', async () => {
      mockPrisma.authorizer.findUnique.mockResolvedValue(null);

      await service.handleAuthorizationRevoked('wx-missing');

      expect(mockPrisma.authorizer.update).not.toHaveBeenCalled();
    });
  });

  // ── revokeAuthorizer 越权防护 ──────────────────────────────────────

  describe('revokeAuthorizer', () => {
    it('should throw NotFoundException for cross-tenant revoke', async () => {
      mockPrisma.authorizer.findFirst.mockResolvedValue(null);

      await expect(
        service.revokeAuthorizer('tenant-A', 'authorizer-of-tenant-B', 'user-1'),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.authorizer.update).not.toHaveBeenCalled();
    });

    it('should mark revoked and write audit log on success', async () => {
      mockPrisma.authorizer.findFirst.mockResolvedValue({
        id: 'a1', tenantId: 't1', appId: 'wx-a1', nickName: 'MP',
      });
      mockPrisma.authorizer.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await service.revokeAuthorizer('t1', 'a1', 'user-1');

      expect(result.status).toBe('revoked');
      expect(result.revokedAt).toBeInstanceOf(Date);
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 't1', userId: 'user-1',
            action: 'platform.revoke',
            resource: 'authorizer',
            resourceId: 'a1',
          }),
        }),
      );
    });
  });
});
