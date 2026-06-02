-- 20260531061909_add_conversion_analytics / down.sql
-- 逆序: FK → INDEX → TABLE

-- 1. 删 FK
ALTER TABLE "conversion_funnels" DROP CONSTRAINT IF EXISTS "conversion_funnels_tenantId_fkey";
ALTER TABLE "conversion_funnels" DROP CONSTRAINT IF EXISTS "conversion_funnels_authorizerId_fkey";
ALTER TABLE "rfm_segments" DROP CONSTRAINT IF EXISTS "rfm_segments_followerId_fkey";
ALTER TABLE "follower_events" DROP CONSTRAINT IF EXISTS "follower_events_followerId_fkey";

-- 2. 删 INDEX
DROP INDEX IF EXISTS "conversion_funnels_tenantId_authorizerId_idx";
DROP INDEX IF EXISTS "rfm_segments_authorizerId_segment_idx";
DROP INDEX IF EXISTS "rfm_segments_followerId_key";
DROP INDEX IF EXISTS "follower_events_authorizerId_followerId_createdAt_idx";
DROP INDEX IF EXISTS "follower_events_authorizerId_eventType_createdAt_idx";
DROP INDEX IF EXISTS "follower_events_createdAt_idx";
DROP INDEX IF EXISTS "cohort_retentions_authorizerId_cohortDate_idx";
DROP INDEX IF EXISTS "cohort_retentions_authorizerId_cohortDate_period_key";

-- 3. 删表 (逆序)
DROP TABLE IF EXISTS "cohort_retentions" CASCADE;
DROP TABLE IF EXISTS "follower_events" CASCADE;
DROP TABLE IF EXISTS "rfm_segments" CASCADE;
DROP TABLE IF EXISTS "conversion_funnels" CASCADE;
