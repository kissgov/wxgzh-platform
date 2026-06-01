// Follower Controller — 粉丝管理 API
// ============================================================================
import {
  Controller, Get, Post, Put, Delete, Param, Query, Body, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantId, RequirePermission } from '../../common/decorators/current-user.decorator';
import { FollowerService } from './follower.service';
import {
  FollowerListQueryDto, CreateTagDto, BatchTagDto, CreateTagRuleDto, UpdateTagRuleDto,
} from './follower.dto';

@ApiTags('粉丝管理')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('followers')
export class FollowerController {
  constructor(private readonly followerService: FollowerService) {}

  // ── 粉丝列表 + 详情 ────────────────────────────────────────────────

  @Get()
  @RequirePermission('follower:read')
  @ApiOperation({ summary: '粉丝列表（支持多维度筛选）' })
  async list(
    @TenantId() tenantId: string,
    @Query('authorizerId') authorizerId: string,
    @Query() query: FollowerListQueryDto,
  ) {
    if (!authorizerId) return { code: 10001, message: 'authorizerId 必填', data: null };
    const data = await this.followerService.getFollowers(tenantId, authorizerId, query);
    return { code: 0, message: '成功', data };
  }

  @Get(':followerId')
  @RequirePermission('follower:read')
  @ApiOperation({ summary: '粉丝详情' })
  async detail(
    @TenantId() tenantId: string,
    @Param('followerId') followerId: string,
  ) {
    const data = await this.followerService.getFollowerDetail(tenantId, followerId);
    return { code: 0, message: '成功', data };
  }

  // ── 标签管理 ────────────────────────────────────────────────────────

  @Get('tags/list')
  @RequirePermission('follower:read')
  @ApiOperation({ summary: '标签列表' })
  async listTags(@Query('authorizerId') authorizerId: string) {
    const data = await this.followerService.getTags(authorizerId);
    return { code: 0, message: '成功', data };
  }

  @Post('tags')
  @RequirePermission('follower:tag')
  @ApiOperation({ summary: '创建标签' })
  async createTag(
    @TenantId() tenantId: string,
    @Query('authorizerId') authorizerId: string,
    @Body() dto: CreateTagDto,
  ) {
    const data = await this.followerService.createTag(authorizerId, tenantId, dto);
    return { code: 0, message: '标签已创建', data };
  }

  @Put('tags/:tagId')
  @RequirePermission('follower:tag')
  @ApiOperation({ summary: '编辑标签' })
  async updateTag(
    @TenantId() tenantId: string,
    @Param('tagId') tagId: string,
    @Body() dto: Partial<CreateTagDto>,
  ) {
    const data = await this.followerService.updateTag(tagId, tenantId, dto);
    return { code: 0, message: '标签已更新', data };
  }

  @Delete('tags/:tagId')
  @RequirePermission('follower:tag')
  @ApiOperation({ summary: '删除标签' })
  async deleteTag(
    @TenantId() tenantId: string,
    @Param('tagId') tagId: string,
  ) {
    await this.followerService.deleteTag(tagId, tenantId);
    return { code: 0, message: '标签已删除', data: null };
  }

  @Post('tags/batch')
  @RequirePermission('follower:tag')
  @ApiOperation({ summary: '批量打标签' })
  async batchTag(
    @TenantId() tenantId: string,
    @Body() dto: BatchTagDto,
  ) {
    const data = await this.followerService.batchTag(tenantId, dto);
    return { code: 0, message: `成功 ${data.success}/${data.total}`, data };
  }

  @Delete('tags/batch')
  @RequirePermission('follower:tag')
  @ApiOperation({ summary: '批量移除标签' })
  async batchUntag(
    @TenantId() tenantId: string,
    @Body() dto: BatchTagDto,
  ) {
    const data = await this.followerService.batchUntag(tenantId, dto);
    return { code: 0, message: `已移除 ${data.removed}`, data };
  }

  // ── 标签规则 ────────────────────────────────────────────────────────

  @Get('tags/rules')
  @RequirePermission('follower:read')
  @ApiOperation({ summary: '标签规则列表' })
  async listTagRules(@Query('authorizerId') authorizerId: string) {
    const data = await this.followerService.getTagRules(authorizerId);
    return { code: 0, message: '成功', data };
  }

  @Post('tags/rules')
  @RequirePermission('follower:tag')
  @ApiOperation({ summary: '创建标签规则' })
  async createTagRule(
    @TenantId() tenantId: string,
    @Query('authorizerId') authorizerId: string,
    @Body() dto: CreateTagRuleDto,
  ) {
    const data = await this.followerService.createTagRule(tenantId, authorizerId, dto);
    return { code: 0, message: '规则已创建', data };
  }

  @Put('tags/rules/:ruleId')
  @RequirePermission('follower:tag')
  @ApiOperation({ summary: '编辑标签规则' })
  async updateTagRule(@Param('ruleId') ruleId: string, @Body() dto: UpdateTagRuleDto) {
    const data = await this.followerService.updateTagRule(ruleId, dto);
    return { code: 0, message: '规则已更新', data };
  }

  @Delete('tags/rules/:ruleId')
  @RequirePermission('follower:tag')
  @ApiOperation({ summary: '删除标签规则' })
  async deleteTagRule(@Param('ruleId') ruleId: string) {
    await this.followerService.deleteTagRule(ruleId);
    return { code: 0, message: '规则已删除', data: null };
  }

  @Post('tags/rules/:ruleId/execute')
  @RequirePermission('follower:tag')
  @ApiOperation({ summary: '执行标签规则' })
  async executeTagRule(@Param('ruleId') ruleId: string) {
    const data = await this.followerService.executeTagRule(ruleId);
    return { code: 0, message: '规则执行完成', data };
  }

  // ── 黑名单 ──────────────────────────────────────────────────────────

  @Get('blacklist')
  @RequirePermission('follower:blacklist')
  @ApiOperation({ summary: '黑名单列表' })
  async blacklist(
    @Query('authorizerId') authorizerId: string,
    @Query('page') page?: number,
  ) {
    const data = await this.followerService.getBlacklist(authorizerId, page);
    return { code: 0, message: '成功', data };
  }

  @Post(':followerId/blacklist')
  @RequirePermission('follower:blacklist')
  @ApiOperation({ summary: '加入黑名单' })
  async block(
    @Query('authorizerId') authorizerId: string,
    @Param('followerId') followerId: string,
    @Body('reason') reason?: string,
  ) {
    const data = await this.followerService.addToBlacklist(authorizerId, followerId, reason);
    return { code: 0, message: '已拉黑', data };
  }

  @Delete(':followerId/blacklist')
  @RequirePermission('follower:blacklist')
  @ApiOperation({ summary: '移除黑名单' })
  async unblock(
    @Query('authorizerId') authorizerId: string,
    @Param('followerId') followerId: string,
  ) {
    await this.followerService.removeFromBlacklist(authorizerId, followerId);
    return { code: 0, message: '已移除黑名单', data: null };
  }

  // ── 粉丝画像 ────────────────────────────────────────────────────────

  @Get('portrait/stats')
  @RequirePermission('follower:read')
  @ApiOperation({ summary: '粉丝画像统计' })
  async portrait(@Query('authorizerId') authorizerId: string) {
    const data = await this.followerService.getPortrait(authorizerId);
    return { code: 0, message: '成功', data };
  }
}
