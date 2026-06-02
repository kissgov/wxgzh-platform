-- 20260531040741_add_team_collaboration / down.sql
-- 逆序: FK → INDEX → TABLE

-- 1. 删 FK
ALTER TABLE "invitations" DROP CONSTRAINT IF EXISTS "invitations_tenantId_fkey";
ALTER TABLE "invitations" DROP CONSTRAINT IF EXISTS "invitations_inviterId_fkey";
ALTER TABLE "approval_workflows" DROP CONSTRAINT IF EXISTS "approval_workflows_tenantId_fkey";
ALTER TABLE "approval_requests" DROP CONSTRAINT IF EXISTS "approval_requests_tenantId_fkey";
ALTER TABLE "approval_requests" DROP CONSTRAINT IF EXISTS "approval_requests_workflowId_fkey";
ALTER TABLE "approval_requests" DROP CONSTRAINT IF EXISTS "approval_requests_submitterId_fkey";
ALTER TABLE "approval_steps" DROP CONSTRAINT IF EXISTS "approval_steps_requestId_fkey";
ALTER TABLE "approval_steps" DROP CONSTRAINT IF EXISTS "approval_steps_approverId_fkey";
ALTER TABLE "team_activities" DROP CONSTRAINT IF EXISTS "team_activities_tenantId_fkey";
ALTER TABLE "team_activities" DROP CONSTRAINT IF EXISTS "team_activities_userId_fkey";

-- 2. 删 INDEX
DROP INDEX IF EXISTS "invitations_token_key";
DROP INDEX IF EXISTS "invitations_tenantId_status_idx";
DROP INDEX IF EXISTS "invitations_email_idx";
DROP INDEX IF EXISTS "approval_workflows_tenantId_idx";
DROP INDEX IF EXISTS "approval_workflows_tenantId_resourceType_idx";
DROP INDEX IF EXISTS "approval_requests_tenantId_status_idx";
DROP INDEX IF EXISTS "approval_requests_resourceType_resourceId_idx";
DROP INDEX IF EXISTS "approval_requests_submitterId_idx";
DROP INDEX IF EXISTS "approval_steps_requestId_idx";
DROP INDEX IF EXISTS "approval_steps_approverId_status_idx";
DROP INDEX IF EXISTS "team_activities_tenantId_createdAt_idx";

-- 3. 删表 (逆序)
DROP TABLE IF EXISTS "team_activities" CASCADE;
DROP TABLE IF EXISTS "approval_steps" CASCADE;
DROP TABLE IF EXISTS "approval_requests" CASCADE;
DROP TABLE IF EXISTS "approval_workflows" CASCADE;
DROP TABLE IF EXISTS "invitations" CASCADE;
