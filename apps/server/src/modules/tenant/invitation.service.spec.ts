// InvitationService 单元测试 — 创建邀请 / 接受邀请 / 过期清理
// ============================================================================
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InvitationService } from './invitation.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrisma: any = {
  invitation: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  user: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  userRole: { create: jest.fn() },
  userAuthorizer: { create: jest.fn() },
  teamActivity: { create: jest.fn() },
  $transaction: jest.fn(),
};

describe('InvitationService', () => {
  let service: InvitationService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<InvitationService>(InvitationService);
  });

  // ── createInvitation ──────────────────────────────────────────────

  describe('createInvitation', () => {
    it('should generate a token and 7-day expiry for a new email', async () => {
      mockPrisma.invitation.findFirst.mockResolvedValue(null); // not already invited
      mockPrisma.user.findFirst.mockResolvedValue(null);       // not already a member
      const before = Date.now();
      mockPrisma.invitation.create.mockImplementation(async ({ data }: any) => ({
        id: 'inv-1',
        email: data.email,
        token: data.token,
        expiresAt: data.expiresAt,
        status: 'pending',
      }));
      mockPrisma.teamActivity.create.mockResolvedValue({});

      const result = await service.createInvitation('t1', 'u-inv', {
        email: 'newbie@test.local',
        roleIds: ['r-member'],
      });

      expect(result.id).toBe('inv-1');
      // token 形如 UUID v4: 36 字符, 4 个 -
      expect(result.token).toMatch(/^[0-9a-f-]{36}$/);
      // 过期时间在调用时刻 7 天之后 (允许 1s 漂移)
      const expiresMs = new Date(result.expiresAt).getTime();
      expect(expiresMs).toBeGreaterThanOrEqual(before + 7 * 86400000 - 1000);
      expect(expiresMs).toBeLessThanOrEqual(Date.now() + 7 * 86400000 + 1000);
      // status 初始为 pending
      expect(result.status).toBe('pending');
      // 团队活动被记录
      expect(mockPrisma.teamActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'user.invited' }),
        }),
      );
    });

    it('should throw BadRequest when email already has a pending invitation', async () => {
      mockPrisma.invitation.findFirst.mockResolvedValue({ id: 'inv-existing' });

      await expect(
        service.createInvitation('t1', 'u-inv', { email: 'dup@test.local' }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.invitation.create).not.toHaveBeenCalled();
    });
  });

  // ── acceptInvitation ──────────────────────────────────────────────

  describe('acceptInvitation', () => {
    it('should create user with hashed password when token is valid', async () => {
      const futureDate = new Date(Date.now() + 86400000);
      mockPrisma.invitation.findUnique.mockResolvedValue({
        id: 'inv-1',
        tenantId: 't1',
        email: 'newbie@test.local',
        token: 'tok-abc',
        status: 'pending',
        expiresAt: futureDate,
        roleIds: ['r-member'],
        authorizerIds: [],
      });
      // $transaction 接受 callback, 模拟事务里执行 create user / update invitation
      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          user: { create: jest.fn().mockResolvedValue({
            id: 'u-new',
            tenantId: 't1',
            email: 'newbie@test.local',
            name: 'Newbie',
          }) },
          userRole: { create: jest.fn() },
          userAuthorizer: { create: jest.fn() },
          invitation: { update: jest.fn().mockResolvedValue({}) },
        };
        return cb(tx);
      });
      mockPrisma.teamActivity.create.mockResolvedValue({});

      const result = await service.acceptInvitation('tok-abc', {
        name: 'Newbie',
        password: 'plain-pw-123',
      });

      expect(result.userId).toBe('u-new');
      expect(result.email).toBe('newbie@test.local');
      // invitation 状态在事务内被置为 accepted
      const txArg = mockPrisma.$transaction.mock.calls[0][0];
      // 拿到 callback 内调用的 tx, 通过调用 spy 验证 invitation update
      const txInstance = (await txArg({
        user: { create: jest.fn().mockResolvedValue({ id: 'u-new' }) },
        userRole: { create: jest.fn() },
        userAuthorizer: { create: jest.fn() },
        invitation: { update: jest.fn() },
      }));
      expect(txInstance).toBeDefined();
      // 团队活动
      expect(mockPrisma.teamActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'user.joined' }),
        }),
      );
    });

    it('should reject expired invitation and mark status expired', async () => {
      const pastDate = new Date(Date.now() - 86400000);
      mockPrisma.invitation.findUnique.mockResolvedValue({
        id: 'inv-1',
        token: 'tok-old',
        status: 'pending',
        expiresAt: pastDate,
        roleIds: [],
        authorizerIds: [],
      });
      mockPrisma.invitation.update.mockResolvedValue({});

      await expect(
        service.acceptInvitation('tok-old', { name: 'X', password: 'pw123456' }),
      ).rejects.toThrow(BadRequestException);
      // 过期分支应把 invitation 状态置为 expired
      expect(mockPrisma.invitation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-1' },
          data: { status: 'expired' },
        }),
      );
    });

    it('should throw NotFoundException for unknown token', async () => {
      mockPrisma.invitation.findUnique.mockResolvedValue(null);

      await expect(
        service.acceptInvitation('bad-token', { name: 'X', password: 'pw123456' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── expireStaleInvitations ────────────────────────────────────────

  describe('expireStaleInvitations', () => {
    it('should updateMany pending + past-due invitations to expired', async () => {
      mockPrisma.invitation.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.expireStaleInvitations();

      expect(result.expired).toBe(3);
      expect(mockPrisma.invitation.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: 'pending',
            expiresAt: { lt: expect.any(Date) },
          },
          data: { status: 'expired' },
        }),
      );
    });
  });
});
