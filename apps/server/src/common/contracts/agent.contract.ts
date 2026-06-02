/**
 * AI Agent 模块 Zod 契约
 *
 * - InputSchema 严格对应 AgentController method 入参
 * - OutputSchema 对应 AgentService 实际返回结构 (service 是 source of truth)
 * - 额外包含 Skill / Agent / AgentTask 子 schema
 * - 覆盖内置 Skills 初始化 / Skill CRUD / Agent CRUD / Task 执行 / Task 列表
 *
 * 字段命名: camelCase (V1 风格)
 */
import { z } from 'zod';
import { PageQuerySchema } from './pagination.contract';

// ── 通用子 schema ────────────────────────────────────────────────────────

/** Skill(完整记录) — service.getSkills / createSkill 直接返回 prisma.skill */
const SkillSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  icon: z.string(),
  prompt: z.string(),
  inputSchema: z.unknown().nullable(),
  outputSchema: z.unknown().nullable(),
  category: z.string(),
  isSystem: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});
export type Skill = z.infer<typeof SkillSchema>;

/** AgentSkill 关联 — Agent.agentSkills.include.skill 元素 */
const AgentSkillWithSkillSchema = z.object({
  id: z.string().min(1),
  agentId: z.string().min(1),
  skillId: z.string().min(1),
  priority: z.number().int(),
  config: z.unknown().nullable(),
  skill: SkillSchema,
});
export type AgentSkillWithSkill = z.infer<typeof AgentSkillWithSkillSchema>;

/** Agent(含 agentSkills) — service.getAgents 直接返回 prisma.agent + include */
const AgentWithSkillsSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  name: z.string(),
  description: z.string().nullable(),
  avatar: z.string(),
  systemPrompt: z.string().nullable(),
  config: z.unknown().nullable(),
  status: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
  agentSkills: z.array(AgentSkillWithSkillSchema),
});
export type AgentWithSkills = z.infer<typeof AgentWithSkillsSchema>;

/** AgentTask(含 agent / skill 关联) — service.getTasks.list 元素 */
const AgentTaskWithRelationsSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  agentId: z.string().min(1),
  skillId: z.string().nullable(),
  name: z.string(),
  input: z.string(),
  output: z.string().nullable(),
  status: z.string(), // pending | running | completed | failed
  errorMsg: z.string().nullable(),
  tokensUsed: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  finishedAt: z.string().datetime().nullable(),
  agent: z.object({ name: z.string() }),
  skill: z.object({ name: z.string() }).nullable(),
});
export type AgentTaskWithRelations = z.infer<typeof AgentTaskWithRelationsSchema>;

/** 空响应 (data: null) */
export const VoidResponseSchema = z.null();
export type VoidResponse = z.infer<typeof VoidResponseSchema>;

// ── Input schema ─────────────────────────────────────────────────────────

/** GET /agents/skills — 列表查询 (category 可选过滤) */
export const ListSkillsQuerySchema = z.object({
  category: z.string().optional(),
});
export type ListSkillsQuery = z.infer<typeof ListSkillsQuerySchema>;

/** POST /agents/skills — 创建 Skill (替代 V1 body: any)
 *  - 字段从 prisma.skill 模型 + service.createSkill `prisma.skill.create({ data: { tenantId, ...dto } })` 推断
 *  - 必填:name / slug / prompt;其余 optional (有 default)
 */
export const CreateSkillInputSchema = z.object({
  name: z.string().min(1, '请填写技能名称'),
  slug: z.string().min(1, '请填写技能标识 slug'),
  prompt: z.string().min(1, '请填写系统提示词'),
  description: z.string().optional(),
  icon: z.string().optional(),
  category: z.string().optional(),
  inputSchema: z.record(z.string(), z.unknown()).optional(),
  outputSchema: z.record(z.string(), z.unknown()).optional(),
});
export type CreateSkillInput = z.infer<typeof CreateSkillInputSchema>;

/** POST /agents — 创建 Agent (替代 V1 body: any)
 *  - 字段从 service.createAgent `name, description, systemPrompt, config, skillIds?` 推断
 */
export const CreateAgentInputSchema = z.object({
  name: z.string().min(1, '请填写 Agent 名称'),
  description: z.string().optional(),
  systemPrompt: z.string().min(1, '请填写系统提示词'),
  config: z.record(z.string(), z.unknown()).optional(),
  skillIds: z.array(z.string().min(1)).optional(),
});
export type CreateAgentInput = z.infer<typeof CreateAgentInputSchema>;

/** POST /agents/:id/run — 执行任务入参 (替代 V1 内联 { input, skillId? }) */
export const RunTaskInputSchema = z.object({
  input: z.string().min(1, '请填写任务输入'),
  skillId: z.string().min(1).optional(),
});
export type RunTaskInput = z.infer<typeof RunTaskInputSchema>;

/** GET /agents/:id/tasks — 任务列表
 *  - V1 controller 仅接 page 单参数,这里扩展完整分页以保持一致性
 *  - page_size 默认 20 与 PageQuerySchema 一致,无需覆盖
 */
export const ListAgentTasksQuerySchema = PageQuerySchema.extend({});
export type ListAgentTasksQuery = z.infer<typeof ListAgentTasksQuerySchema>;

// ── Output schema ────────────────────────────────────────────────────────

/** POST /agents/seed-skills — V1 行为 data: null */
export const SeedSkillsOutputSchema = VoidResponseSchema;
export type SeedSkillsOutput = z.infer<typeof SeedSkillsOutputSchema>;

/** GET /agents/skills — service.getSkills 数组 */
export const ListSkillsOutputSchema = z.array(SkillSchema);
export type ListSkillsOutput = z.infer<typeof ListSkillsOutputSchema>;

/** POST /agents/skills — service.createSkill */
export const CreateSkillOutputSchema = SkillSchema;
export type CreateSkillOutput = z.infer<typeof CreateSkillOutputSchema>;

/** DELETE /agents/skills/:id — service.deleteSkill 返回 { deleted: true } */
export const DeleteSkillOutputSchema = z.object({
  deleted: z.literal(true),
});
export type DeleteSkillOutput = z.infer<typeof DeleteSkillOutputSchema>;

/** GET /agents — service.getAgents 数组 */
export const ListAgentsOutputSchema = z.array(AgentWithSkillsSchema);
export type ListAgentsOutput = z.infer<typeof ListAgentsOutputSchema>;

/** POST /agents — service.createAgent (含 agentSkills 关联) */
export const CreateAgentOutputSchema = AgentWithSkillsSchema;
export type CreateAgentOutput = z.infer<typeof CreateAgentOutputSchema>;

/** DELETE /agents/:id — service.deleteAgent 返回 { deleted: true } */
export const DeleteAgentOutputSchema = z.object({
  deleted: z.literal(true),
});
export type DeleteAgentOutput = z.infer<typeof DeleteAgentOutputSchema>;

/** POST /agents/:id/run — service.executeTask 返回 { taskId, output, tokensUsed, durationMs } */
export const RunTaskOutputSchema = z.object({
  taskId: z.string().min(1),
  output: z.string(),
  tokensUsed: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
});
export type RunTaskOutput = z.infer<typeof RunTaskOutputSchema>;

/** GET /agents/:id/tasks — service.getTasks 分页 */
export const ListAgentTasksOutputSchema = z.object({
  list: z.array(AgentTaskWithRelationsSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  page_size: z.number().int().positive(),
});
export type ListAgentTasksOutput = z.infer<typeof ListAgentTasksOutputSchema>;
