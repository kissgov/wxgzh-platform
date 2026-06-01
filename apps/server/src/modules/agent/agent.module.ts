import { Module, OnModuleInit } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { LlmModule } from '../llm/llm.module';
import { PrismaService } from '../../prisma/prisma.service';

@Module({ imports: [LlmModule], controllers: [AgentController], providers: [AgentService], exports: [AgentService] })
export class AgentModule {}
