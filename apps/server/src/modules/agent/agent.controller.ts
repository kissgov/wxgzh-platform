// Agent Controller — Agent + Skill 管理 API
import { Controller, Get, Post, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantId, RequireRoles } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/security/require-permission.decorator';
import { PERMISSIONS } from '../../common/security/permissions';
import { AgentService } from './agent.service';

@ApiTags('AI Agent')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('agents')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('seed-skills') @RequireRoles('super_admin')
  async seed(@TenantId() tenantId: string) { await this.agentService.seedBuiltinSkills(tenantId); return { code: 0, message: '内置 Skills 已初始化', data: null }; }

  @Get('skills') @RequirePermission(PERMISSIONS.AGENT_READ)
  async getSkills(@TenantId() tenantId: string, @Query('category') category?: string) { return { code: 0, message: '成功', data: await this.agentService.getSkills(tenantId, category) }; }
  @Post('skills') @RequirePermission(PERMISSIONS.AGENT_WRITE)
  async createSkill(@TenantId() tenantId: string, @Body() body: any) { return { code: 0, message: 'Skill 已创建', data: await this.agentService.createSkill(tenantId, body) }; }
  @Delete('skills/:id') @RequirePermission(PERMISSIONS.AGENT_WRITE)
  async deleteSkill(@Param('id') id: string) { return { code: 0, message: '已删除', data: await this.agentService.deleteSkill(id) }; }

  @Get() @RequirePermission(PERMISSIONS.AGENT_READ)
  async getAgents(@TenantId() tenantId: string) { return { code: 0, message: '成功', data: await this.agentService.getAgents(tenantId) }; }
  @Post() @RequirePermission(PERMISSIONS.AGENT_WRITE)
  async createAgent(@TenantId() tenantId: string, @Body() body: any) { return { code: 0, message: 'Agent 已创建', data: await this.agentService.createAgent(tenantId, body) }; }
  @Delete(':id') @RequirePermission(PERMISSIONS.AGENT_WRITE)
  async deleteAgent(@Param('id') id: string) { return { code: 0, message: '已删除', data: await this.agentService.deleteAgent(id) }; }

  @Post(':id/run') @RequirePermission(PERMISSIONS.AGENT_RUN)
  async runTask(@TenantId() tenantId: string, @Param('id') id: string, @Body() body: { input: string; skillId?: string }) {
    try { return { code: 0, message: '执行完成', data: await this.agentService.executeTask(tenantId, id, body.input, body.skillId) }; }
    catch (e: any) { return { code: 20001, message: e.message, data: null }; }
  }

  @Get(':id/tasks') @RequirePermission(PERMISSIONS.AGENT_READ)
  async getTasks(@TenantId() tenantId: string, @Param('id') id: string, @Query('page') page?: number) { return { code: 0, message: '成功', data: await this.agentService.getTasks(tenantId, id, page) }; }
}
