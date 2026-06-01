// Analytics Controller — 数据统计 API
// ============================================================================
import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantId, RequirePermission } from '../../common/decorators/current-user.decorator';
import { AnalyticsService } from './analytics.service';

@ApiTags('数据统计')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @RequirePermission('analytics:read')
  @ApiOperation({ summary: '看板概览' })
  async overview(@Query('authorizerId') authorizerId: string) {
    if (!authorizerId) return { code: 10001, message: 'authorizerId 必填', data: null };
    const data = await this.analyticsService.getOverview(authorizerId);
    return { code: 0, message: '成功', data };
  }

  @Get('followers/trend')
  @RequirePermission('analytics:read')
  @ApiOperation({ summary: '粉丝趋势' })
  async followerTrend(
    @Query('authorizerId') authorizerId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const data = await this.analyticsService.getFollowerTrend(
      authorizerId, startDate, endDate,
    );
    return { code: 0, message: '成功', data };
  }

  @Get('messages/trend')
  @RequirePermission('analytics:read')
  @ApiOperation({ summary: '消息交互趋势' })
  async messageTrend(
    @Query('authorizerId') authorizerId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const data = await this.analyticsService.getMessageTrend(
      authorizerId, startDate, endDate,
    );
    return { code: 0, message: '成功', data };
  }

  @Get('news')
  @RequirePermission('analytics:read')
  @ApiOperation({ summary: '图文分析' })
  async news(
    @Query('authorizerId') authorizerId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('page') page?: number,
  ) {
    const data = await this.analyticsService.getNewsAnalysis(
      authorizerId, startDate, endDate, page,
    );
    return { code: 0, message: '成功', data };
  }

  // ── V1 转化分析 ──────────────────────────────────────────────────

  @Get('funnels')
  @ApiOperation({ summary: '漏斗列表' })
  async listFunnels(@TenantId() tenantId: string, @Query('authorizerId') authorizerId: string) {
    const data = await this.analyticsService.getFunnels(tenantId, authorizerId);
    return { code: 0, message: '成功', data };
  }

  @Post('funnels')
  @ApiOperation({ summary: '创建漏斗' })
  async createFunnel(@TenantId() tenantId: string, @Query('authorizerId') authorizerId: string, @Body() body: any) {
    const data = await this.analyticsService.createFunnel(tenantId, authorizerId, body);
    return { code: 0, message: '漏斗已创建', data };
  }

  @Get('funnels/:id/data')
  @ApiOperation({ summary: '漏斗数据' })
  async getFunnelData(@TenantId() tenantId: string, @Param('id') id: string) {
    const data = await this.analyticsService.getFunnelData(tenantId, id);
    return { code: 0, message: '成功', data };
  }

  @Get('rfm/overview')
  @ApiOperation({ summary: 'RFM 分段概览' })
  async rfmOverview(@Query('authorizerId') authorizerId: string) {
    const data = await this.analyticsService.getRfmOverview(authorizerId);
    return { code: 0, message: '成功', data };
  }

  @Post('rfm/compute')
  @ApiOperation({ summary: '计算 RFM 分数' })
  async computeRfm(@Query('authorizerId') authorizerId: string) {
    const data = await this.analyticsService.computeRfm(authorizerId);
    return { code: 0, message: 'RFM 计算完成', data };
  }
}
