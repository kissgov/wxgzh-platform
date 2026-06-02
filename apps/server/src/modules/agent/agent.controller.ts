// Agent Controller — Agent + Skill 管理 API
import { Controller, Get, Post, Delete, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantId, RequireRoles } from '../../common/decorators/current-user.decorator';
import { ZodBody } from '../../common/decorators/zod-body.decorator';
import { ZodResponse } from '../../common/decorators/zod-response.decorator';
import { AgentService } from './agent.service';
import {
  CreateSkillInputSchema,
  CreateAgentInputSchema,
  RunTaskInputSchema,
  SeedSkillsOutputSchema,
  ListSkillsOutputSchema,
  CreateSkillOutputSchema,
  DeleteSkillOutputSchema,
  ListAgentsOutputSchema,
  CreateAgentOutputSchema,
  DeleteAgentOutputSchema,
  RunTaskOutputSchema,
  ListAgentTasksOutputSchema,
  type CreateSkillInput,
  type CreateAgentInput,
  type RunTaskInput,
} from '../../common/contracts/agent.contract';

@ApiTags('AI Agent')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('agents')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('seed-skills') @RequireRoles('super_admin')
  @ZodResponse(SeedSkillsOutputSchema)
  async seed(@TenantId() tenantId: string) { await this.agentService.seedBuiltinSkills(tenantId); return { code: 0, message: '内置 Skills 已初始化', data: null }; }

  @Get('skills') @ZodResponse(ListSkillsOutputSchema)
  async getSkills(@TenantId() tenantId: string, @Query('category') category?: string) { return { code: 0, message: '成功', data: await this.agentService.getSkills(tenantId, category) }; }

  @Post('skills') @ZodResponse(CreateSkillOutputSchema)
  async createSkill(
    @TenantId() tenantId: string,
    @ZodBody(CreateSkillInputSchema) input: CreateSkillInput,
  ) { return { code: 0, message: 'Skill 已创建', data: await this.agentService.createSkill(tenantId, input) }; }

  @Delete('skills/:id') @ZodResponse(DeleteSkillOutputSchema)
  async deleteSkill(@Param('id') id: string) { return { code: 0, message: '已删除', data: await this.agentService.deleteSkill(id) }; }

  @Get() @ZodResponse(ListAgentsOutputSchema)
  async getAgents(@TenantId() tenantId: string) { return { code: 0, message: '成功', data: await this.agentService.getAgents(tenantId) }; }

  @Post() @ZodResponse(CreateAgentOutputSchema)
  async createAgent(
    @TenantId() tenantId: string,
    @ZodBody(CreateAgentInputSchema) input: CreateAgentInput,
  ) { return { code: 0, message: 'Agent 已创建', data: await this.agentService.createAgent(tenantId, input) }; }

  @Delete(':id') @ZodResponse(DeleteAgentOutputSchema)
  async deleteAgent(@Param('id') id: string) { return { code: 0, message: '已删除', data: await this.agentService.deleteAgent(id) }; }

  @Post(':id/run')
  @ZodResponse(RunTaskOutputSchema)
  async runTask(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @ZodBody(RunTaskInputSchema) input: RunTaskInput,
  ) {
    try { return { code: 0, message: '执行完成', data: await this.agentService.executeTask(tenantId, id, input.input, input.skillId) }; }
    catch (e: any) { return { code: 20001, message: e.message, data: null }; }
  }

  @Get(':id/tasks') @ZodResponse(ListAgentTasksOutputSchema)
  async getTasks(@TenantId() tenantId: string, @Param('id') id: string, @Query('page') page?: number) { return { code: 0, message: '成功', data: await this.agentService.getTasks(tenantId, id, page) }; }
}
