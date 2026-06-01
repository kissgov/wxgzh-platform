import { Module } from '@nestjs/common';
import { TenantController } from './tenant.controller';
import { TeamController } from './team.controller';
import { TenantService } from './tenant.service';
import { InvitationService } from './invitation.service';
import { ApprovalService } from './approval.service';
import { TeamActivityService } from './team-activity.service';

@Module({
  controllers: [TenantController, TeamController],
  providers: [TenantService, InvitationService, ApprovalService, TeamActivityService],
  exports: [TenantService, InvitationService, ApprovalService],
})
export class TenantModule {}
