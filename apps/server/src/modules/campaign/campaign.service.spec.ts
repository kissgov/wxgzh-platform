// CampaignService 单元测试 — 营销活动 CRUD + 状态过滤 + 渠道二维码
// ============================================================================
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CampaignService } from './campaign.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrisma: any = {
  campaign: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  channelQrCode: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

describe('CampaignService', () => {
  let service: CampaignService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<CampaignService>(CampaignService);
  });

  // ── createCampaign (含 type/startAt/endAt) ────────────────────────

  describe('createCampaign (with scheduling)', () => {
    it('should create campaign with type, startAt, endAt converted to Date', async () => {
      const created = {
        id: 'c1', tenantId: 't1', authorizerId: 'a1',
        name: '双十一活动', type: 'h5_page', status: 'draft',
        startAt: new Date('2026-11-01T00:00:00Z'),
        endAt: new Date('2026-11-11T23:59:59Z'),
      };
      mockPrisma.campaign.create.mockResolvedValue(created);

      const result = await service.createCampaign('t1', 'a1', {
        name: '双十一活动',
        type: 'h5_page',
        description: '满减促销',
        startAt: '2026-11-01T00:00:00Z',
        endAt: '2026-11-11T23:59:59Z',
      } as any);

      expect(result.id).toBe('c1');
      expect(result.type).toBe('h5_page');

      // create 必传: tenantId, authorizerId, name, type, description, startAt(Date), endAt(Date)
      expect(mockPrisma.campaign.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 't1',
          authorizerId: 'a1',
          name: '双十一活动',
          type: 'h5_page',
          description: '满减促销',
          startAt: new Date('2026-11-01T00:00:00Z'),
          endAt: new Date('2026-11-11T23:59:59Z'),
        }),
      });
    });

    it('should leave startAt/endAt null when not provided', async () => {
      mockPrisma.campaign.create.mockResolvedValue({ id: 'c2' });

      await service.createCampaign('t1', 'a1', { name: '不限时', type: 'qrcode' } as any);

      const call = mockPrisma.campaign.create.mock.calls[0][0];
      expect(call.data.startAt).toBeNull();
      expect(call.data.endAt).toBeNull();
    });
  });

  // ── getCampaigns 状态过滤 ─────────────────────────────────────────

  describe('getCampaigns (status filter)', () => {
    it('should filter by status and apply tenant + authorizer + deletedAt=null', async () => {
      mockPrisma.campaign.findMany.mockResolvedValue([
        { id: 'c1', status: 'active', name: 'A' },
        { id: 'c2', status: 'active', name: 'B' },
      ]);
      mockPrisma.campaign.count.mockResolvedValue(2);

      const result = await service.getCampaigns('t1', 'a1', {
        page: 1, page_size: 20, status: 'active',
      } as any);

      expect(result.list).toHaveLength(2);
      expect(result.total).toBe(2);

      const findCall = mockPrisma.campaign.findMany.mock.calls[0][0];
      // 越权防护 + 状态过滤
      expect(findCall.where.tenantId).toBe('t1');
      expect(findCall.where.authorizerId).toBe('a1');
      expect(findCall.where.deletedAt).toBeNull();
      expect(findCall.where.status).toBe('active');
      // include stats
      expect(findCall.include.stats).toBe(true);
      // 分页
      expect(findCall.skip).toBe(0);
      expect(findCall.take).toBe(20);
    });

    it('should not add status filter when omitted', async () => {
      mockPrisma.campaign.findMany.mockResolvedValue([]);
      mockPrisma.campaign.count.mockResolvedValue(0);

      await service.getCampaigns('t1', 'a1', { page: 1, page_size: 10 } as any);

      const findCall = mockPrisma.campaign.findMany.mock.calls[0][0];
      expect(findCall.where.status).toBeUndefined();
    });
  });

  // ── createQrCode (含 sceneStr) ───────────────────────────────────

  describe('createQrCode (with sceneStr)', () => {
    it('should create channel QR with campaignId binding and sceneStr', async () => {
      mockPrisma.channelQrCode.create.mockResolvedValue({
        id: 'qr-1', tenantId: 't1', authorizerId: 'a1',
        campaignId: 'c1', name: '地推A', sceneStr: 'scene_promo_a',
      });

      const result = await service.createQrCode('t1', 'a1', {
        name: '地推A',
        sceneStr: 'scene_promo_a',
        campaignId: 'c1',
      } as any);

      expect(result.id).toBe('qr-1');
      // create 必传 tenantId + authorizerId + campaignId + name + sceneStr
      expect(mockPrisma.channelQrCode.create).toHaveBeenCalledWith({
        data: {
          tenantId: 't1',
          authorizerId: 'a1',
          campaignId: 'c1',
          name: '地推A',
          sceneStr: 'scene_promo_a',
        },
      });
    });

    it('should allow QR without campaignId (standalone)', async () => {
      mockPrisma.channelQrCode.create.mockResolvedValue({ id: 'qr-2' });

      await service.createQrCode('t1', 'a1', { name: '通用', sceneStr: 's1' } as any);

      const call = mockPrisma.channelQrCode.create.mock.calls[0][0];
      expect(call.data.campaignId).toBeUndefined();
    });
  });

  // ── getCampaign 越权防护 ──────────────────────────────────────────

  describe('getCampaign (cross-tenant guard)', () => {
    it('should throw NotFoundException when campaign not in tenant', async () => {
      mockPrisma.campaign.findFirst.mockResolvedValue(null);

      await expect(service.getCampaign('tenant-A', 'campaign-of-tenant-B'))
        .rejects.toThrow(NotFoundException);

      const findCall = mockPrisma.campaign.findFirst.mock.calls[0][0];
      expect(findCall.where.tenantId).toBe('tenant-A');
      expect(findCall.where.deletedAt).toBeNull();
    });
  });
});
