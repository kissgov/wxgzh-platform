// Tasks Module — BullMQ Workers + Scheduled Jobs
// ============================================================================
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { TokenRefreshProcessor } from './token-refresh.processor';
import { SyncDataProcessor } from './sync-data.processor';
import { TagRuleProcessor } from './tag-rule.processor';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [
    ScheduleModule,
    BullModule.registerQueue(
      { name: 'token-refresh' },
      { name: 'sync-data' },
      { name: 'tag-rule' },
    ),
  ],
  providers: [TokenRefreshProcessor, SyncDataProcessor, TagRuleProcessor, SchedulerService],
  exports: [TokenRefreshProcessor, SyncDataProcessor, TagRuleProcessor],
})
export class TasksModule {}
