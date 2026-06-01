// Campaign Service — 营销活动 + 渠道二维码
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CampaignListQueryDto, CreateCampaignDto, CreateQrCodeDto } from './campaign.dto';

@Injectable()
export class CampaignService {
  private readonly logger = new Logger(CampaignService.name);
  constructor(private readonly prisma: PrismaService) {}

  async getCampaigns(tenantId: string, authorizerId: string, query: CampaignListQueryDto) {
    const { page = 1, page_size = 20, type, status } = query;
    const where: Record<string, unknown> = { tenantId, authorizerId, deletedAt: null };
    if (type) where['type'] = type;
    if (status) where['status'] = status;
    const [list, total] = await Promise.all([
      this.prisma.campaign.findMany({ where: where as any, include: { stats: true }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * page_size, take: page_size }),
      this.prisma.campaign.count({ where: where as any }),
    ]);
    return { list, total, page, page_size };
  }

  async createCampaign(tenantId: string, authorizerId: string, dto: CreateCampaignDto) {
    return this.prisma.campaign.create({
      data: { tenantId, authorizerId, name: dto.name, type: dto.type, description: dto.description, config: dto.config as any, startAt: dto.startAt ? new Date(dto.startAt) : null, endAt: dto.endAt ? new Date(dto.endAt) : null },
    });
  }

  async getCampaign(tenantId: string, id: string) {
    const c = await this.prisma.campaign.findFirst({ where: { id, tenantId, deletedAt: null }, include: { stats: true } });
    if (!c) throw new NotFoundException('活动不存在');
    return c;
  }

  async updateCampaign(tenantId: string, id: string, dto: Partial<CreateCampaignDto>) {
    return this.prisma.campaign.update({ where: { id }, data: { ...dto, config: dto.config as any } });
  }

  async deleteCampaign(id: string) { await this.prisma.campaign.update({ where: { id }, data: { deletedAt: new Date() } }); return { deleted: true }; }

  async changeStatus(id: string, status: string) {
    return this.prisma.campaign.update({ where: { id }, data: { status } });
  }

  // ── 渠道二维码 ──────────────────────────────────────────────────

  async getQrCodes(tenantId: string, authorizerId: string, campaignId?: string) {
    const where: Record<string, unknown> = { tenantId, authorizerId, deletedAt: null };
    if (campaignId) where['campaignId'] = campaignId;
    return this.prisma.channelQrCode.findMany({ where: where as any, orderBy: { createdAt: 'desc' } });
  }

  async createQrCode(tenantId: string, authorizerId: string, dto: CreateQrCodeDto) {
    return this.prisma.channelQrCode.create({
      data: { tenantId, authorizerId, campaignId: dto.campaignId, name: dto.name, sceneStr: dto.sceneStr },
    });
  }

  async deleteQrCode(id: string) { await this.prisma.channelQrCode.update({ where: { id }, data: { deletedAt: new Date() } }); return { deleted: true }; }
}
