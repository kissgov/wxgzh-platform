// Follower Controller — 粉丝管理 API
// ============================================================================
import {
  Controller, Get, Post, Put, Delete, Param, Query, Body, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantId, RequirePermission } from '../../common/decorators/current-user.decorator';
import { ZodBody } from '../../common/decorators/zod-body.decorator';
import { ZodQuery } from '../../common/decorators/zod-query.decorator';
import { ZodResponse } from '../../common/decorators/zod-response.decorator';
import { FollowerService } from './follower.service';
import {
  ListFollowersQuerySchema,
  CreateTagInputSchema,
  UpdateTagInputSchema,
  BatchTagInputSchema,
  BatchUntagInputSchema,
  CreateTagRuleInputSchema,
  UpdateTagRuleInputSchema,
  ListFollowersOutputSchema,
  GetFollowerDetailOutputSchema,
  ListTagsOutputSchema,
  CreateTagOutputSchema,
  UpdateTagOutputSchema,
  BatchTagOutputSchema,
  BatchUntagOutputSchema,
  ListTagRulesOutputSchema,
  CreateTagRuleOutputSchema,
  UpdateTagRuleOutputSchema,
  ExecuteTagRuleOutputSchema,
  GetBlacklistOutputSchema,
  AddToBlacklistOutputSchema,
  GetPortraitOutputSchema,
  type ListFollowersQuery,
  type CreateTagInput,
  type UpdateTagInput,
  type BatchTagInput,
  type BatchUntagInput,
  type CreateTagRuleInput,
  type UpdateTagRuleInput,
} from '../../common/contracts/follower.contract';

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
  @ZodResponse(ListFollowersOutputSchema)
  async list(
    @TenantId() tenantId: string,
    @Query('authorizerId') authorizerId: string,
    @ZodQuery(ListFollowersQuerySchema) q: ListFollowersQuery,
  ) {
    if (!authorizerId) return { code: 10001, message: 'authorizerId 必填', data: null };
    const data = await this.followerService.getFollowers(tenantId, authorizerId, q);
    return { code: 0, message: '成功', data };
  }

  @Get(':followerId')
  @RequirePermission('follower:read')
  @ApiOperation({ summary: '粉丝详情' })
  @ZodResponse(GetFollowerDetailOutputSchema)
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
  @ZodResponse(ListTagsOutputSchema)
  async listTags(@Query('authorizerId') authorizerId: string) {
    const data = await this.followerService.getTags(authorizerId);
    return { code: 0, message: '成功', data };
  }

  @Post('tags')
  @RequirePermission('follower:tag')
  @ApiOperation({ summary: '创建标签' })
  @ZodResponse(CreateTagOutputSchema)
  async createTag(
    @TenantId() tenantId: string,
    @Query('authorizerId') authorizerId: string,
    @ZodBody(CreateTagInputSchema) input: CreateTagInput,
  ) {
    const data = await this.followerService.createTag(authorizerId, tenantId, input);
    return { code: 0, message: '标签已创建', data };
  }

  @Put('tags/:tagId')
  @RequirePermission('follower:tag')
  @ApiOperation({ summary: '编辑标签' })
  @ZodResponse(UpdateTagOutputSchema)
  async updateTag(
    @TenantId() tenantId: string,
    @Param('tagId') tagId: string,
    @ZodBody(UpdateTagInputSchema) input: UpdateTagInput,
  ) {
    const data = await this.followerService.updateTag(tagId, tenantId, input);
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
  @ZodResponse(BatchTagOutputSchema)
  async batchTag(
    @TenantId() tenantId: string,
    @ZodBody(BatchTagInputSchema) input: BatchTagInput,
  ) {
    const data = await this.followerService.batchTag(tenantId, input);
    return { code: 0, message: `成功 ${data.success}/${data.total}`, data };
  }

  @Delete('tags/batch')
  @RequirePermission('follower:tag')
  @ApiOperation({ summary: '批量移除标签' })
  @ZodResponse(BatchUntagOutputSchema)
  async batchUntag(
    @TenantId() tenantId: string,
    @ZodBody(BatchUntagInputSchema) input: BatchUntagInput,
  ) {
    const data = await this.followerService.batchUntag(tenantId, input);
    return { code: 0, message: `已移除 ${data.removed}`, data };
  }

  // ── 标签规则 ────────────────────────────────────────────────────────

  @Get('tags/rules')
  @RequirePermission('follower:read')
  @ApiOperation({ summary: '标签规则列表' })
  @ZodResponse(ListTagRulesOutputSchema)
  async listTagRules(@Query('authorizerId') authorizerId: string) {
    const data = await this.followerService.getTagRules(authorizerId);
    return { code: 0, message: '成功', data };
  }

  @Post('tags/rules')
  @RequirePermission('follower:tag')
  @ApiOperation({ summary: '创建标签规则' })
  @ZodResponse(CreateTagRuleOutputSchema)
  async createTagRule(
    @TenantId() tenantId: string,
    @Query('authorizerId') authorizerId: string,
    @ZodBody(CreateTagRuleInputSchema) input: CreateTagRuleInput,
  ) {
    const dto = {
      ...input,
      conditions: input.conditions.map((c) => ({ ...c, value: c.value ?? null })),
    };
    const data = await this.followerService.createTagRule(tenantId, authorizerId, dto);
    return { code: 0, message: '规则已创建', data };
  }

  @Put('tags/rules/:ruleId')
  @RequirePermission('follower:tag')
  @ApiOperation({ summary: '编辑标签规则' })
  @ZodResponse(UpdateTagRuleOutputSchema)
  async updateTagRule(
    @Param('ruleId') ruleId: string,
    @ZodBody(UpdateTagRuleInputSchema) input: UpdateTagRuleInput,
  ) {
    const dto = {
      ...input,
      conditions: input.conditions?.map((c) => ({ ...c, value: c.value ?? null })),
    };
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
  @ZodResponse(ExecuteTagRuleOutputSchema)
  async executeTagRule(@Param('ruleId') ruleId: string) {
    const data = await this.followerService.executeTagRule(ruleId);
    return { code: 0, message: '规则执行完成', data };
  }

  // ── 黑名单 ──────────────────────────────────────────────────────────

  @Get('blacklist')
  @RequirePermission('follower:blacklist')
  @ApiOperation({ summary: '黑名单列表' })
  @ZodResponse(GetBlacklistOutputSchema)
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
  @ZodResponse(AddToBlacklistOutputSchema)
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
  @ZodResponse(GetPortraitOutputSchema)
  async portrait(@Query('authorizerId') authorizerId: string) {
    const data = await this.followerService.getPortrait(authorizerId);
    return { code: 0, message: '成功', data };
  }
}
