// Campaign Controller
import { Controller, Get, Post, Put, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantId, RequirePermission } from '../../common/decorators/current-user.decorator';
import { CampaignService } from './campaign.service';
import { CampaignListQueryDto, CreateCampaignDto, CreateQrCodeDto } from './campaign.dto';

@ApiTags('营销活动')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('campaigns')
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  @Get()
  @RequirePermission('follower:read')
  @ApiOperation({ summary: '活动列表' })
  async list(@TenantId() tenantId: string, @Query('authorizerId') authorizerId: string, @Query() query: CampaignListQueryDto) {
    if (!authorizerId) return { code: 10001, message: 'authorizerId 必填', data: null };
    const data = await this.campaignService.getCampaigns(tenantId, authorizerId, query);
    return { code: 0, message: '成功', data };
  }

  @Post()
  @ApiOperation({ summary: '创建活动' })
  async create(@TenantId() tenantId: string, @Query('authorizerId') authorizerId: string, @Body() dto: CreateCampaignDto) {
    if (!authorizerId) return { code: 10001, message: 'authorizerId 必填', data: null };
    const data = await this.campaignService.createCampaign(tenantId, authorizerId, dto);
    return { code: 0, message: '活动已创建', data };
  }

  @Get(':id')
  @ApiOperation({ summary: '活动详情' })
  async detail(@TenantId() tenantId: string, @Param('id') id: string) {
    const data = await this.campaignService.getCampaign(tenantId, id);
    return { code: 0, message: '成功', data };
  }

  @Put(':id')
  @ApiOperation({ summary: '编辑活动' })
  async update(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: Partial<CreateCampaignDto>) {
    const data = await this.campaignService.updateCampaign(tenantId, id, dto);
    return { code: 0, message: '已更新', data };
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除活动' })
  async delete(@Param('id') id: string) { await this.campaignService.deleteCampaign(id); return { code: 0, message: '已删除', data: null }; }

  @Post(':id/:action')
  @ApiOperation({ summary: '活动状态操作 (start/pause/end)' })
  async changeStatus(@Param('id') id: string, @Param('action') action: string) {
    if (!['start', 'pause', 'end'].includes(action)) return { code: 10001, message: '无效操作', data: null };
    const status = action === 'start' ? 'active' : action === 'pause' ? 'paused' : 'ended';
    const data = await this.campaignService.changeStatus(id, status);
    return { code: 0, message: '状态已更新', data };
  }

  // ── 渠道二维码 ──────────────────────────────────────────────────

  @Get('qrcodes/list')
  @ApiOperation({ summary: '渠道码列表' })
  async qrList(@TenantId() tenantId: string, @Query('authorizerId') authorizerId: string, @Query('campaignId') campaignId?: string) {
    const data = await this.campaignService.getQrCodes(tenantId, authorizerId, campaignId);
    return { code: 0, message: '成功', data };
  }

  @Post('qrcodes')
  @ApiOperation({ summary: '创建渠道二维码' })
  async createQr(@TenantId() tenantId: string, @Query('authorizerId') authorizerId: string, @Body() dto: CreateQrCodeDto) {
    if (!authorizerId) return { code: 10001, message: 'authorizerId 必填', data: null };
    const data = await this.campaignService.createQrCode(tenantId, authorizerId, dto);
    return { code: 0, message: '渠道码已创建', data };
  }

  @Delete('qrcodes/:id')
  @ApiOperation({ summary: '删除渠道码' })
  async deleteQr(@Param('id') id: string) { await this.campaignService.deleteQrCode(id); return { code: 0, message: '已删除', data: null }; }
}
