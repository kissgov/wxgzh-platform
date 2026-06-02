-- 20260531035452_unify_schema_billing / down.sql
-- 逆序: FK → INDEX → DROP COLUMN → TABLE

-- 1. 删 FK
ALTER TABLE "user_authorizers" DROP CONSTRAINT IF EXISTS "user_authorizers_tenantId_fkey";
ALTER TABLE "user_authorizers" DROP CONSTRAINT IF EXISTS "user_authorizers_userId_fkey";
ALTER TABLE "user_authorizers" DROP CONSTRAINT IF EXISTS "user_authorizers_authorizerId_fkey";
ALTER TABLE "subscription_records" DROP CONSTRAINT IF EXISTS "subscription_records_tenantId_fkey";
ALTER TABLE "payment_orders" DROP CONSTRAINT IF EXISTS "payment_orders_tenantId_fkey";

-- 2. 删 INDEX
DROP INDEX IF EXISTS "user_authorizers_tenantId_userId_idx";
DROP INDEX IF EXISTS "user_authorizers_userId_authorizerId_key";
DROP INDEX IF EXISTS "subscription_plans_slug_key";
DROP INDEX IF EXISTS "subscription_records_tenantId_createdAt_idx";
DROP INDEX IF EXISTS "payment_orders_tenantId_createdAt_idx";

-- 3. 删列 (ALTER TABLE ADD COLUMN 逆序)
ALTER TABLE "tenants" DROP COLUMN IF EXISTS "billingPeriod";
ALTER TABLE "tenants" DROP COLUMN IF EXISTS "maxAuthorizers";
ALTER TABLE "tenants" DROP COLUMN IF EXISTS "maxUsers";
ALTER TABLE "tenants" DROP COLUMN IF EXISTS "plan";
ALTER TABLE "tenants" DROP COLUMN IF EXISTS "subscriptionExpiresAt";
ALTER TABLE "tenants" DROP COLUMN IF EXISTS "trialEndsAt";

-- 4. 删表 (逆序)
DROP TABLE IF EXISTS "payment_orders" CASCADE;
DROP TABLE IF EXISTS "subscription_records" CASCADE;
DROP TABLE IF EXISTS "subscription_plans" CASCADE;
DROP TABLE IF EXISTS "user_authorizers" CASCADE;
