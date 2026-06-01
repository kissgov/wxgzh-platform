// LLM Controller — AI 配置 + 调用
import { Controller, Get, Post, Put, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantId, RequireRoles, RequirePermission } from '../../common/decorators/current-user.decorator';
import { LlmService } from './llm.service';

@ApiTags('AI 大模型')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class LlmController {
  constructor(private readonly llmService: LlmService) {}

  // ── Admin 配置 ──────────────────────────────────────────────────

  @Get('admin/llm-config')
  @RequireRoles('super_admin')
  @ApiOperation({ summary: '获取 LLM 配置' })
  async getConfig(@TenantId() tenantId: string) {
    const data = await this.llmService.getConfig(tenantId);
    return { code: 0, message: '成功', data: data || { provider: 'openai', model: 'gpt-4o', temperature: 0.7, maxTokens: 4096, dailyLimit: 100, status: 'active' } };
  }

  @Put('admin/llm-config')
  @RequireRoles('super_admin')
  @ApiOperation({ summary: '更新 LLM 配置' })
  async updateConfig(@TenantId() tenantId: string, @Body() body: any) {
    const data = await this.llmService.upsertConfig(tenantId, body);
    return { code: 0, message: '配置已保存', data };
  }

  @Get('admin/llm-stats')
  @RequireRoles('super_admin')
  @ApiOperation({ summary: 'LLM 调用统计' })
  async getStats(@TenantId() tenantId: string) {
    const data = await this.llmService.getUsageStats(tenantId);
    return { code: 0, message: '成功', data };
  }

  @Get('admin/llm-logs')
  @RequireRoles('super_admin')
  @ApiOperation({ summary: 'LLM 调用日志' })
  async getLogs(@TenantId() tenantId: string, @Query('page') page?: number) {
    const data = await this.llmService.getUsageLogs(tenantId, page);
    return { code: 0, message: '成功', data };
  }

  // ── 用户端 AI 调用 ──────────────────────────────────────────────

  @Post('articles/ai/generate')
  @ApiOperation({ summary: 'AI 生成内容' })
  async aiGenerate(@TenantId() tenantId: string, @Body() body: { prompt: string; type?: string; context?: string }) {
    try {
      const { content } = await this.llmService.chat(tenantId, {
        scene: `article_${body.type || 'generate'}`,
        messages: [
          { role: 'system', content: body.type === 'outline' ? '你是一个专业的内容策划，请为用户生成文章大纲。返回简洁的结构化大纲。' : '你是一个专业的微信公众号内容创作者，擅长中文写作。请根据用户需求生成高质量的文章内容。直接返回正文，无需标题。' },
          { role: 'user', content: body.context ? `参考上下文：${body.context}\n\n需求：${body.prompt}` : body.prompt },
        ],
      });
      return { code: 0, message: '生成成功', data: { content } };
    } catch (e: any) { return { code: 20001, message: e.message, data: null }; }
  }

  // ── AI 自动化 ──────────────────────────────────────────────────

  @Post('llm/auto-reply')
  @ApiOperation({ summary: 'AI 智能回复 (用于消息自动回复兜底)' })
  async autoReply(
    @TenantId() tenantId: string,
    @Query('authorizerId') authorizerId: string,
    @Body() body: { message: string },
  ) {
    const reply = await this.llmService.autoReply(tenantId, authorizerId, body.message);
    return { code: 0, message: '成功', data: { reply } };
  }

  @Post('llm/scheduled-article')
  @ApiOperation({ summary: 'AI 定时创作文章草稿' })
  async scheduledArticle(
    @TenantId() tenantId: string,
    @Query('authorizerId') authorizerId: string,
    @Body() body: { topic: string },
  ) {
    try {
      const article = await this.llmService.generateScheduledArticle(tenantId, authorizerId, body.topic);
      return { code: 0, message: 'AI 文章草稿已生成', data: article };
    } catch (e: any) { return { code: 20001, message: e.message, data: null }; }
  }

  @Post('llm/weekly-report')
  @ApiOperation({ summary: 'AI 生成周报' })
  async weeklyReport(
    @TenantId() tenantId: string,
    @Query('authorizerId') authorizerId: string,
  ) {
    try {
      const data = await this.llmService.generateWeeklyReport(tenantId, authorizerId);
      return { code: 0, message: '周报已生成', data };
    } catch (e: any) { return { code: 20001, message: e.message, data: null }; }
  }

  @Post('articles/ai/rewrite')
  @ApiOperation({ summary: 'AI 改写' })
  async aiRewrite(@TenantId() tenantId: string, @Body() body: { content: string; style?: string }) {
    try {
      const { content } = await this.llmService.chat(tenantId, {
        scene: 'article_rewrite',
        messages: [
          { role: 'system', content: `你是一个文案优化专家。请${body.style ? `用${body.style}风格` : ''}改写以下内容，保持原意但改善表达。直接返回改写结果。` },
          { role: 'user', content: body.content },
        ],
      });
      return { code: 0, message: '改写成功', data: { content } };
    } catch (e: any) { return { code: 20001, message: e.message, data: null }; }
  }
}
