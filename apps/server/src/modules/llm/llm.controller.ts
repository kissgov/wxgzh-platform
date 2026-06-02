// LLM Controller — AI 配置 + 调用
import { Controller, Get, Post, Put, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantId, RequireRoles } from '../../common/decorators/current-user.decorator';
import { ZodBody } from '../../common/decorators/zod-body.decorator';
import { ZodResponse } from '../../common/decorators/zod-response.decorator';
import { LlmService } from './llm.service';
import {
  UpdateConfigInputSchema,
  AiGenerateInputSchema,
  AutoReplyInputSchema,
  ScheduledArticleInputSchema,
  AiRewriteInputSchema,
  GetConfigOutputSchema,
  UpdateConfigOutputSchema,
  UsageStatsOutputSchema,
  ListUsageLogsOutputSchema,
  AiGenerateOutputSchema,
  AutoReplyOutputSchema,
  ScheduledArticleOutputSchema,
  WeeklyReportOutputSchema,
  AiRewriteOutputSchema,
  type UpdateConfigInput,
  type AiGenerateInput,
  type AutoReplyInput,
  type ScheduledArticleInput,
  type AiRewriteInput,
} from '../../common/contracts/llm.contract';

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
  @ZodResponse(GetConfigOutputSchema)
  async getConfig(@TenantId() tenantId: string) {
    const data = await this.llmService.getConfig(tenantId);
    return { code: 0, message: '成功', data: data || { provider: 'openai', model: 'gpt-4o', temperature: 0.7, maxTokens: 4096, dailyLimit: 100, status: 'active' } };
  }

  @Put('admin/llm-config')
  @RequireRoles('super_admin')
  @ApiOperation({ summary: '更新 LLM 配置' })
  @ZodResponse(UpdateConfigOutputSchema)
  async updateConfig(@TenantId() tenantId: string, @ZodBody(UpdateConfigInputSchema) input: UpdateConfigInput) {
    const data = await this.llmService.upsertConfig(tenantId, input);
    return { code: 0, message: '配置已保存', data };
  }

  @Get('admin/llm-stats')
  @RequireRoles('super_admin')
  @ApiOperation({ summary: 'LLM 调用统计' })
  @ZodResponse(UsageStatsOutputSchema)
  async getStats(@TenantId() tenantId: string) {
    const data = await this.llmService.getUsageStats(tenantId);
    return { code: 0, message: '成功', data };
  }

  @Get('admin/llm-logs')
  @RequireRoles('super_admin')
  @ApiOperation({ summary: 'LLM 调用日志' })
  @ZodResponse(ListUsageLogsOutputSchema)
  async getLogs(@TenantId() tenantId: string, @Query('page') page?: number) {
    const data = await this.llmService.getUsageLogs(tenantId, page);
    return { code: 0, message: '成功', data };
  }

  // ── 用户端 AI 调用 ──────────────────────────────────────────────

  @Post('articles/ai/generate')
  @ApiOperation({ summary: 'AI 生成内容' })
  @ZodResponse(AiGenerateOutputSchema)
  async aiGenerate(@TenantId() tenantId: string, @ZodBody(AiGenerateInputSchema) input: AiGenerateInput) {
    try {
      const { content } = await this.llmService.chat(tenantId, {
        scene: `article_${input.type || 'generate'}`,
        messages: [
          { role: 'system', content: input.type === 'outline' ? '你是一个专业的内容策划，请为用户生成文章大纲。返回简洁的结构化大纲。' : '你是一个专业的微信公众号内容创作者，擅长中文写作。请根据用户需求生成高质量的文章内容。直接返回正文，无需标题。' },
          { role: 'user', content: input.context ? `参考上下文：${input.context}\n\n需求：${input.prompt}` : input.prompt },
        ],
      });
      return { code: 0, message: '生成成功', data: { content } };
    } catch (e: any) { return { code: 20001, message: e.message, data: null }; }
  }

  // ── AI 自动化 ──────────────────────────────────────────────────

  @Post('llm/auto-reply')
  @ApiOperation({ summary: 'AI 智能回复 (用于消息自动回复兜底)' })
  @ZodResponse(AutoReplyOutputSchema)
  async autoReply(
    @TenantId() tenantId: string,
    @Query('authorizerId') authorizerId: string,
    @ZodBody(AutoReplyInputSchema) input: AutoReplyInput,
  ) {
    const reply = await this.llmService.autoReply(tenantId, authorizerId, input.message);
    return { code: 0, message: '成功', data: { reply } };
  }

  @Post('llm/scheduled-article')
  @ApiOperation({ summary: 'AI 定时创作文章草稿' })
  @ZodResponse(ScheduledArticleOutputSchema)
  async scheduledArticle(
    @TenantId() tenantId: string,
    @Query('authorizerId') authorizerId: string,
    @ZodBody(ScheduledArticleInputSchema) input: ScheduledArticleInput,
  ) {
    try {
      const article = await this.llmService.generateScheduledArticle(tenantId, authorizerId, input.topic);
      return { code: 0, message: 'AI 文章草稿已生成', data: article };
    } catch (e: any) { return { code: 20001, message: e.message, data: null }; }
  }

  @Post('llm/weekly-report')
  @ApiOperation({ summary: 'AI 生成周报' })
  @ZodResponse(WeeklyReportOutputSchema)
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
  @ZodResponse(AiRewriteOutputSchema)
  async aiRewrite(@TenantId() tenantId: string, @ZodBody(AiRewriteInputSchema) input: AiRewriteInput) {
    try {
      const { content } = await this.llmService.chat(tenantId, {
        scene: 'article_rewrite',
        messages: [
          { role: 'system', content: `你是一个文案优化专家。请${input.style ? `用${input.style}风格` : ''}改写以下内容，保持原意但改善表达。直接返回改写结果。` },
          { role: 'user', content: input.content },
        ],
      });
      return { code: 0, message: '改写成功', data: { content } };
    } catch (e: any) { return { code: 20001, message: e.message, data: null }; }
  }
}
