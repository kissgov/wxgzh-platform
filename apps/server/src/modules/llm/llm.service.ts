// LLM Service — 多 Provider 抽象 + 限额 + 日志
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import axios from 'axios';

interface LlmRequest { scene: string; messages: Array<{ role: string; content: string }>; }
interface LlmResponse { content: string; tokensIn: number; tokensOut: number; durationMs: number; }

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  constructor(private readonly prisma: PrismaService) {}

  private getProviderDefaults(provider: string) {
    const map: Record<string, { url: string; model: string }> = {
      openai: { url: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o' },
      claude: { url: 'https://api.anthropic.com/v1/messages', model: 'claude-sonnet-4-6' },
      deepseek: { url: 'https://api.deepseek.com/v1/chat/completions', model: 'deepseek-chat' },
      qwen: { url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', model: 'qwen-plus' },
      local: { url: 'http://localhost:11434/v1/chat/completions', model: 'llama3' },
    };
    return map[provider] || map['openai']!;
  }

  async chat(tenantId: string, req: LlmRequest): Promise<LlmResponse> {
    const config = await this.prisma.llmConfig.findUnique({ where: { tenantId } });
    if (!config || config.status === 'disabled') throw new BadRequestException('LLM 未配置或已禁用');

    // 限额检查
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const count = await this.prisma.llmUsageLog.count({ where: { configId: config.id, createdAt: { gte: today } } });
    if (count >= config.dailyLimit) throw new BadRequestException(`已达每日调用上限 (${config.dailyLimit})`);

    const startedAt = Date.now();
    const defaults = this.getProviderDefaults(config.provider);
    const apiUrl = config.apiUrl || defaults.url;
    const model = config.model || defaults.model;

    try {
      let content: string; let tokensIn = 0; let tokensOut = 0;

      if (config.provider === 'claude') {
        const systemMsg = req.messages.find(m => m.role === 'system');
        const msgs = req.messages.filter(m => m.role !== 'system');
        const { data } = await axios.post(apiUrl, {
          model, max_tokens: config.maxTokens || 4096,
          system: systemMsg?.content || config.systemPrompt || 'You are a helpful assistant.',
          messages: msgs.map(m => ({ role: m.role, content: m.content })),
        }, { headers: { 'x-api-key': config.apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }, timeout: 60000 });
        content = data.content?.[0]?.text || '';
        tokensIn = data.usage?.input_tokens || 0; tokensOut = data.usage?.output_tokens || 0;
      } else {
        const { data } = await axios.post(apiUrl, {
          model, temperature: config.temperature ?? 0.7, max_tokens: config.maxTokens || 4096,
          messages: req.messages,
        }, { headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' }, timeout: 60000 });
        content = data.choices?.[0]?.message?.content || '';
        tokensIn = data.usage?.prompt_tokens || 0; tokensOut = data.usage?.completion_tokens || 0;
      }

      const durationMs = Date.now() - startedAt;
      await this.logUsage(config.id, tenantId, req.scene, req.messages[req.messages.length - 1]?.content || '', content, model, tokensIn, tokensOut, durationMs, 'success');
      this.logger.log(`LLM call: provider=${config.provider} model=${model} tokens=${tokensIn}/${tokensOut} ms=${durationMs}`);
      return { content, tokensIn, tokensOut, durationMs };
    } catch (err: any) {
      const durationMs = Date.now() - startedAt;
      const errMsg = err.response?.data?.error?.message || err.message;
      await this.logUsage(config.id, tenantId, req.scene, '', '', model, 0, 0, durationMs, 'error', errMsg);
      this.logger.error(`LLM error: ${errMsg}`);
      throw new BadRequestException(`AI 调用失败: ${errMsg}`);
    }
  }

  private async logUsage(configId: string, tenantId: string, scene: string, prompt: string, completion: string, model: string, tokensIn: number, tokensOut: number, durationMs: number, status: string, errorMsg?: string) {
    await this.prisma.llmUsageLog.create({ data: { tenantId, configId, scene, prompt: prompt?.slice(0, 500), completion: completion?.slice(0, 2000), model, tokensIn, tokensOut, durationMs, status, errorMsg: errorMsg?.slice(0, 500) } });
  }

  async getConfig(tenantId: string) {
    const c = await this.prisma.llmConfig.findUnique({ where: { tenantId } });
    return c ? { ...c, apiKey: c.apiKey ? '****' + c.apiKey.slice(-4) : null } : null;
  }

  async upsertConfig(tenantId: string, dto: any) {
    const clean = (v: any) => (v === '' ? null : v);
    const data = {
      provider: clean(dto.provider) || 'openai',
      apiKey: clean(dto.apiKey), apiUrl: clean(dto.apiUrl),
      model: clean(dto.model), temperature: dto.temperature ?? 0.7,
      maxTokens: dto.maxTokens || 4096, systemPrompt: clean(dto.systemPrompt),
      dailyLimit: dto.dailyLimit || 100, status: dto.status || 'active',
    };
    return this.prisma.llmConfig.upsert({ where: { tenantId }, create: { tenantId, ...data }, update: data });
  }

  async getUsageStats(tenantId: string) {
    const config = await this.prisma.llmConfig.findUnique({ where: { tenantId } });
    if (!config) return { today: 0, total: 0, limit: 0 };
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const [todayCount, totalCount] = await Promise.all([
      this.prisma.llmUsageLog.count({ where: { configId: config.id, createdAt: { gte: today } } }),
      this.prisma.llmUsageLog.count({ where: { configId: config.id } }),
    ]);
    return { today: todayCount, total: totalCount, limit: config.dailyLimit };
  }

  // ── AI 自动化 ────────────────────────────────────────────────────

  /** AI 智能客服：根据粉丝消息生成回复 */
  async autoReply(tenantId: string, authorizerId: string, followerMsg: string) {
    const follower = await this.prisma.follower.findFirst({ where: { authorizerId, openid: authorizerId }, select: { nickname: true } });
    const name = follower?.nickname || '用户';
    try {
      const { content } = await this.chat(tenantId, {
        scene: 'auto_reply',
        messages: [
          { role: 'system', content: `你是微信公众号的智能客服。请用亲切友好的中文回复粉丝消息。回复要简洁（50字以内），像真人客服一样自然。粉丝昵称：${name}。` },
          { role: 'user', content: followerMsg },
        ],
      });
      return content?.slice(0, 200) || '感谢您的留言，我们会尽快回复您。';
    } catch {
      return '感谢您的留言，我们会尽快回复您。';
    }
  }

  /** AI 定时内容创作：根据主题生成文章草稿 */
  async generateScheduledArticle(tenantId: string, authorizerId: string, topic: string) {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    try {
      const { content } = await this.chat(tenantId, {
        scene: 'scheduled_article',
        messages: [
          { role: 'system', content: '你是微信公众号专业内容创作者。请生成一篇完整的文章，包含标题（作为第一行，# 开头）和正文。文章800-1500字，结构清晰，语言生动。' },
          { role: 'user', content: `请以"${topic}"为主题创作一篇公众号推文` },
        ],
      });
      const lines = content.split('\n');
      const title = lines[0]?.replace(/^#\s*/, '').slice(0, 64) || `AI创作：${topic}`;
      const body = lines.slice(1).join('\n');
      const article = await prisma.article.create({
        data: { tenantId, authorizerId, title, content: body, author: 'AI助手', digest: body.slice(0, 100), status: 'draft' },
      });
      await prisma.$disconnect();
      this.logger.log(`AI scheduled article created: ${title}`);
      return article;
    } catch (err) {
      this.logger.error(`AI article generation failed: ${(err as Error).message}`);
      throw err;
    }
  }

  /** AI 数据周报：生成运营数据总结 */
  async generateWeeklyReport(tenantId: string, authorizerId: string) {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    try {
      const weekAgo = new Date(Date.now() - 7 * 86400000);
      const [totalFollowers, followerStats, messageStats, topArticles] = await Promise.all([
        prisma.follower.count({ where: { authorizerId, subscribe: true } }),
        prisma.followerStat.aggregate({ where: { authorizerId, statDate: { gte: weekAgo } }, _sum: { newSubscribers: true, unsubscribers: true } }),
        prisma.messageStat.aggregate({ where: { authorizerId, statDate: { gte: weekAgo } }, _sum: { receivedCount: true, replyCount: true } }),
        prisma.newsStat.findMany({ where: { authorizerId, statDate: { gte: weekAgo } }, orderBy: { readCount: 'desc' }, take: 5, select: { title: true, readCount: true, shareCount: true } }),
      ]);
      await prisma.$disconnect();

      const summary = `本周数据：累计粉丝 ${totalFollowers}，新增 ${followerStats._sum.newSubscribers || 0}，取关 ${followerStats._sum.unsubscribers || 0}，收到消息 ${messageStats._sum.receivedCount || 0}，回复 ${messageStats._sum.replyCount || 0}。热门文章：${topArticles.map(a => `《${a.title}》阅读${a.readCount}`).join('、') || '无'}。`;

      const { content } = await this.chat(tenantId, {
        scene: 'weekly_report',
        messages: [
          { role: 'system', content: '你是一个数据分析师。请根据提供的运营数据，生成一份简洁的周报总结（200字以内），包含关键指标、趋势分析和改进建议。' },
          { role: 'user', content: summary },
        ],
      });
      return { summary, report: content };
    } catch (err) {
      this.logger.error(`Weekly report generation failed: ${(err as Error).message}`);
      throw err;
    }
  }

  async getUsageLogs(tenantId: string, page = 1, pageSize = 20) {
    const config = await this.prisma.llmConfig.findUnique({ where: { tenantId } });
    if (!config) return { list: [], total: 0 };
    const where = { configId: config.id };
    const [list, total] = await Promise.all([
      this.prisma.llmUsageLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.llmUsageLog.count({ where }),
    ]);
    return { list, total, page, page_size: pageSize };
  }
}
