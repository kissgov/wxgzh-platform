// AgentService — Agent/Skill 编排引擎
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';

const BUILTIN_SKILLS = [
  { slug: 'content-writer', name: '内容创作', category: 'content', icon: 'EditOutlined',
    description: '根据主题自动生成公众号文章', prompt: '你是微信公众号专业内容创作者。请根据用户需求生成高质量中文文章，包含标题和正文。'},
  { slug: 'content-rewrite', name: '文案润色', category: 'content', icon: 'FormatPainterOutlined',
    description: '改写优化已有文章', prompt: '你是文案优化专家。请改写以下内容，保持原意但改善表达、增强可读性。'},
  { slug: 'customer-service', name: '智能客服', category: 'service', icon: 'CustomerServiceOutlined',
    description: '自动回复粉丝咨询', prompt: '你是微信公众号的智能客服。请用亲切友好的中文回复粉丝消息，50字以内。'},
  { slug: 'data-analyst', name: '数据分析', category: 'analytics', icon: 'BarChartOutlined',
    description: '分析运营数据生成报告', prompt: '你是数据分析师。请根据提供的运营数据生成简洁的分析报告和改进建议。'},
  { slug: 'translator', name: '翻译助手', category: 'general', icon: 'TranslationOutlined',
    description: '中英双向翻译', prompt: '你是专业翻译。请准确翻译以下内容，保持原文风格。'},
  { slug: 'campaign-planner', name: '活动策划', category: 'marketing', icon: 'RocketOutlined',
    description: '策划营销活动方案', prompt: '你是营销策划专家。请根据需求设计微信公众号营销活动方案，包含目标、流程、预期效果。'},
  { slug: 'seo-optimizer', name: 'SEO优化', category: 'content', icon: 'SearchOutlined',
    description: '优化文章标题和关键词', prompt: '你是SEO专家。请优化以下文章标题和摘要，使其更具搜索吸引力。'},
  { slug: 'summarizer', name: '摘要生成', category: 'general', icon: 'FileTextOutlined',
    description: '生成长文摘要', prompt: '请用100字以内总结以下内容的要点。'},
];

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  constructor(private readonly prisma: PrismaService, private readonly llm: LlmService) {}

  async seedBuiltinSkills(tenantId: string) {
    for (const s of BUILTIN_SKILLS) {
      await this.prisma.skill.upsert({
        where: { tenantId_slug: { tenantId, slug: s.slug } },
        create: { tenantId, ...s, isSystem: true },
        update: { name: s.name, description: s.description, prompt: s.prompt, category: s.category },
      });
    }
  }

  // ── Skill CRUD ────────────────────────────────────────────────────

  async getSkills(tenantId: string, category?: string) {
    const where: any = { tenantId, deletedAt: null };
    if (category) where.category = category;
    return this.prisma.skill.findMany({ where, orderBy: { category: 'asc' } });
  }

  async createSkill(tenantId: string, dto: any) {
    return this.prisma.skill.create({ data: { tenantId, ...dto } });
  }

  async deleteSkill(id: string) {
    await this.prisma.skill.update({ where: { id }, data: { deletedAt: new Date() } });
    return { deleted: true };
  }

  // ── Agent CRUD ────────────────────────────────────────────────────

  async getAgents(tenantId: string) {
    return this.prisma.agent.findMany({
      where: { tenantId, deletedAt: null },
      include: { agentSkills: { include: { skill: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createAgent(tenantId: string, dto: any) {
    const agent = await this.prisma.agent.create({
      data: { tenantId, name: dto.name, description: dto.description, systemPrompt: dto.systemPrompt, config: dto.config as any },
    });
    if (dto.skillIds?.length) {
      for (const skillId of dto.skillIds) {
        await this.prisma.agentSkill.create({ data: { agentId: agent.id, skillId, priority: 0 } });
      }
    }
    return agent;
  }

  async deleteAgent(id: string) {
    await this.prisma.agent.update({ where: { id }, data: { deletedAt: new Date() } });
    return { deleted: true };
  }

  // ── Task 执行 ─────────────────────────────────────────────────────

  async executeTask(tenantId: string, agentId: string, input: string, skillId?: string) {
    const agent = await this.prisma.agent.findFirst({ where: { id: agentId, tenantId } });
    if (!agent) throw new NotFoundException('Agent 不存在');

    const task = await this.prisma.agentTask.create({
      data: { tenantId, agentId, skillId, name: `任务-${Date.now()}`, input, status: 'running', startedAt: new Date() },
    });

    try {
      const skill = skillId ? await this.prisma.skill.findUnique({ where: { id: skillId } }) : null;
      const systemPrompt = [agent.systemPrompt, skill?.prompt].filter(Boolean).join('\n') || '你是一个有用的AI助手。';

      const startedAt = Date.now();
      const { content, tokensIn, tokensOut } = await this.llm.chat(tenantId, {
        scene: 'agent_task',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: input },
        ],
      });

      await this.prisma.agentTask.update({
        where: { id: task.id },
        data: { status: 'completed', output: content, tokensUsed: tokensIn + tokensOut, durationMs: Date.now() - startedAt, finishedAt: new Date() },
      });
      this.logger.log(`Agent task completed: ${task.id}`);
      return { taskId: task.id, output: content, tokensUsed: tokensIn + tokensOut, durationMs: Date.now() - startedAt };
    } catch (err: any) {
      await this.prisma.agentTask.update({
        where: { id: task.id },
        data: { status: 'failed', errorMsg: err.message, finishedAt: new Date() },
      });
      throw err;
    }
  }

  async getTasks(tenantId: string, agentId?: string, page = 1, pageSize = 20) {
    const where: any = { tenantId };
    if (agentId) where.agentId = agentId;
    const [list, total] = await Promise.all([
      this.prisma.agentTask.findMany({ where, include: { agent: { select: { name: true } }, skill: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.agentTask.count({ where }),
    ]);
    return { list, total, page, page_size: pageSize };
  }
}
