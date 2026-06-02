-- 20260531055326_add_campaign_models / down.sql
-- 逆序: FK → INDEX → TABLE

-- 1. 删 FK
ALTER TABLE "campaigns" DROP CONSTRAINT IF EXISTS "campaigns_tenantId_fkey";
ALTER TABLE "campaigns" DROP CONSTRAINT IF EXISTS "campaigns_authorizerId_fkey";
ALTER TABLE "campaign_stats" DROP CONSTRAINT IF EXISTS "campaign_stats_campaignId_fkey";
ALTER TABLE "channel_qr_codes" DROP CONSTRAINT IF EXISTS "channel_qr_codes_tenantId_fkey";
ALTER TABLE "channel_qr_codes" DROP CONSTRAINT IF EXISTS "channel_qr_codes_authorizerId_fkey";
ALTER TABLE "channel_qr_codes" DROP CONSTRAINT IF EXISTS "channel_qr_codes_campaignId_fkey";
ALTER TABLE "qr_code_scans" DROP CONSTRAINT IF EXISTS "qr_code_scans_qrCodeId_fkey";

-- 2. 删 INDEX
DROP INDEX IF EXISTS "campaigns_tenantId_authorizerId_idx";
DROP INDEX IF EXISTS "campaigns_authorizerId_status_idx";
DROP INDEX IF EXISTS "campaign_stats_campaignId_key";
DROP INDEX IF EXISTS "channel_qr_codes_tenantId_authorizerId_idx";
DROP INDEX IF EXISTS "channel_qr_codes_campaignId_idx";
DROP INDEX IF EXISTS "channel_qr_codes_authorizerId_sceneStr_key";
DROP INDEX IF EXISTS "qr_code_scans_qrCodeId_scannedAt_idx";

-- 3. 删表 (逆序)
DROP TABLE IF EXISTS "qr_code_scans" CASCADE;
DROP TABLE IF EXISTS "channel_qr_codes" CASCADE;
DROP TABLE IF EXISTS "campaign_stats" CASCADE;
DROP TABLE IF EXISTS "campaigns" CASCADE;
