// Message Controller — 消息管理 API
// ============================================================================
import {
  Controller, Get, Post, Put, Delete, Patch, Param, Query, Body, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantId, RequirePermission } from '../../common/decorators/current-user.decorator';
import { MessageService } from './message.service';
import { LlmService } from '../llm/llm.service';
import { MessageLogQueryDto, CreateAutoReplyDto, CreateBroadcastDto } from './message.dto';

@ApiTags('消息管理')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessageController {
  constructor(
    private readonly messageService: MessageService,
    private readonly llmService: LlmService,
  ) {}

  // ── 消息日志 ────────────────────────────────────────────────────────

  @Get('logs')
  @RequirePermission('message:read')
  @ApiOperation({ summary: '消息日志列表' })
  async logs(
    @Query('authorizerId') authorizerId: string,
    @Query() query: MessageLogQueryDto,
  ) {
    if (!authorizerId) return { code: 10001, message: 'authorizerId 必填', data: null };
    const data = await this.messageService.getMessageLogs(authorizerId, query);
    return { code: 0, message: '成功', data };
  }

  // ── 自动回复规则 ────────────────────────────────────────────────────

  @Get('auto-reply')
  @RequirePermission('message:read')
  @ApiOperation({ summary: '获取自动回复规则列表' })
  async listRules(
    @Query('authorizerId') authorizerId: string,
    @Query('ruleType') ruleType?: string,
  ) {
    const data = await this.messageService.getAutoReplyRules(authorizerId, ruleType);
    return { code: 0, message: '成功', data };
  }

  @Post('auto-reply')
  @RequirePermission('message:create')
  @ApiOperation({ summary: '创建自动回复规则' })
  async createRule(
    @TenantId() tenantId: string,
    @Query('authorizerId') authorizerId: string,
    @Body() dto: CreateAutoReplyDto,
  ) {
    const data = await this.messageService.createAutoReplyRule(tenantId, authorizerId, dto);
    return { code: 0, message: '规则已创建', data };
  }

  @Put('auto-reply/:ruleId')
  @RequirePermission('message:update')
  @ApiOperation({ summary: '编辑自动回复规则' })
  async updateRule(
    @Param('ruleId') ruleId: string,
    @Body() dto: Partial<CreateAutoReplyDto>,
  ) {
    const data = await this.messageService.updateAutoReplyRule(ruleId, dto);
    return { code: 0, message: '规则已更新', data };
  }

  @Delete('auto-reply/:ruleId')
  @RequirePermission('message:delete')
  @ApiOperation({ summary: '删除自动回复规则' })
  async deleteRule(@Param('ruleId') ruleId: string) {
    await this.messageService.deleteAutoReplyRule(ruleId);
    return { code: 0, message: '规则已删除', data: null };
  }

  @Patch('auto-reply/:ruleId/toggle')
  @RequirePermission('message:update')
  @ApiOperation({ summary: '启用/禁用规则' })
  async toggleRule(@Param('ruleId') ruleId: string) {
    const data = await this.messageService.toggleAutoReplyRule(ruleId);
    return { code: 0, message: data.status === 'enabled' ? '已启用' : '已禁用', data };
  }

  // ── 消息群发 ────────────────────────────────────────────────────────

  @Get('broadcast')
  @RequirePermission('message:read')
  @ApiOperation({ summary: '群发消息列表' })
  async listBroadcasts(
    @Query('authorizerId') authorizerId: string,
    @Query('page') page?: number,
  ) {
    const data = await this.messageService.getBroadcasts({ authorizerId, page });
    return { code: 0, message: '成功', data };
  }

  @Post('broadcast')
  @RequirePermission('message:broadcast')
  @ApiOperation({ summary: '创建群发消息' })
  async createBroadcast(
    @TenantId() tenantId: string,
    @Query('authorizerId') authorizerId: string,
    @Body() dto: CreateBroadcastDto,
  ) {
    const data = await this.messageService.createBroadcast(tenantId, authorizerId, dto);
    return { code: 0, message: '群发已创建', data };
  }

  @Post('broadcast/:id/send')
  @RequirePermission('message:broadcast')
  @ApiOperation({ summary: '发送群发消息' })
  async sendBroadcast(@Param('id') id: string) {
    await this.messageService.sendBroadcast(id);
    return { code: 0, message: '群发已提交', data: { status: 'pending' } };
  }

  @Get('broadcast/:id/progress')
  @RequirePermission('message:read')
  @ApiOperation({ summary: '查询发送进度' })
  async progress(@Param('id') id: string) {
    const data = await this.messageService.getBroadcastProgress(id);
    return { code: 0, message: '成功', data };
  }

  /** AI 智能回复：先匹配规则，无匹配则调用 LLM */
  @Post('ai-reply')
  @ApiOperation({ summary: 'AI 智能回复（规则优先，LLM 兜底）' })
  async aiReply(
    @TenantId() tenantId: string,
    @Query('authorizerId') authorizerId: string,
    @Body() body: { keyword: string },
  ) {
    // 1. 先尝试关键词匹配
    const rule = await this.messageService.matchKeywordReply(authorizerId, body.keyword);
    if (rule) {
      const firstContent = rule.replyContents?.[0];
      return { code: 0, message: '规则匹配', data: { reply: firstContent?.content || '', source: 'rule' } };
    }
    // 2. LLM 智能兜底
    const aiReply = await this.llmService.autoReply(tenantId, authorizerId, body.keyword);
    return { code: 0, message: 'AI 回复', data: { reply: aiReply, source: 'ai' } };
  }
}
