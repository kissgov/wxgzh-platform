// Analytics Controller — 数据统计 API
// ============================================================================
import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantId, RequirePermission } from '../../common/decorators/current-user.decorator';
import { ZodBody } from '../../common/decorators/zod-body.decorator';
import { ZodResponse } from '../../common/decorators/zod-response.decorator';
import { AnalyticsService } from './analytics.service';
import {
  CreateFunnelInputSchema,
  OverviewOutputSchema,
  FollowerTrendOutputSchema,
  MessageTrendOutputSchema,
  ListNewsAnalysisOutputSchema,
  ListFunnelsOutputSchema,
  CreateFunnelOutputSchema,
  GetFunnelDataOutputSchema,
  ListRfmSegmentsOutputSchema,
  ComputeRfmOutputSchema,
  type CreateFunnelInput,
} from '../../common/contracts/analytics.contract';

@ApiTags('数据统计')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @RequirePermission('analytics:read')
  @ApiOperation({ summary: '看板概览' })
  @ZodResponse(OverviewOutputSchema)
  async overview(@Query('authorizerId') authorizerId: string) {
    if (!authorizerId) return { code: 10001, message: 'authorizerId 必填', data: null };
    const data = await this.analyticsService.getOverview(authorizerId);
    return { code: 0, message: '成功', data };
  }

  @Get('followers/trend')
  @RequirePermission('analytics:read')
  @ApiOperation({ summary: '粉丝趋势' })
  @ZodResponse(FollowerTrendOutputSchema)
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
  @ZodResponse(MessageTrendOutputSchema)
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
  @ZodResponse(ListNewsAnalysisOutputSchema)
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
  @ZodResponse(ListFunnelsOutputSchema)
  async listFunnels(@TenantId() tenantId: string, @Query('authorizerId') authorizerId: string) {
    const data = await this.analyticsService.getFunnels(tenantId, authorizerId);
    return { code: 0, message: '成功', data };
  }

  @Post('funnels')
  @ApiOperation({ summary: '创建漏斗' })
  @ZodResponse(CreateFunnelOutputSchema)
  async createFunnel(
    @TenantId() tenantId: string,
    @Query('authorizerId') authorizerId: string,
    @ZodBody(CreateFunnelInputSchema) input: CreateFunnelInput,
  ) {
    const data = await this.analyticsService.createFunnel(tenantId, authorizerId, input);
    return { code: 0, message: '漏斗已创建', data };
  }

  @Get('funnels/:id/data')
  @ApiOperation({ summary: '漏斗数据' })
  @ZodResponse(GetFunnelDataOutputSchema)
  async getFunnelData(@TenantId() tenantId: string, @Param('id') id: string) {
    const data = await this.analyticsService.getFunnelData(tenantId, id);
    return { code: 0, message: '成功', data };
  }

  @Get('rfm/overview')
  @ApiOperation({ summary: 'RFM 分段概览' })
  @ZodResponse(ListRfmSegmentsOutputSchema)
  async rfmOverview(@Query('authorizerId') authorizerId: string) {
    const data = await this.analyticsService.getRfmOverview(authorizerId);
    return { code: 0, message: '成功', data };
  }

  @Post('rfm/compute')
  @ApiOperation({ summary: '计算 RFM 分数' })
  @ZodResponse(ComputeRfmOutputSchema)
  async computeRfm(@Query('authorizerId') authorizerId: string) {
    const data = await this.analyticsService.computeRfm(authorizerId);
    return { code: 0, message: 'RFM 计算完成', data };
  }
}
