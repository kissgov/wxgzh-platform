-- 20260531053850_add_content_creation / down.sql
-- 逆序: FK → INDEX → TABLE

-- 1. 删 FK
ALTER TABLE "articles" DROP CONSTRAINT IF EXISTS "articles_tenantId_fkey";
ALTER TABLE "articles" DROP CONSTRAINT IF EXISTS "articles_authorizerId_fkey";
ALTER TABLE "articles" DROP CONSTRAINT IF EXISTS "articles_categoryId_fkey";
ALTER TABLE "article_revisions" DROP CONSTRAINT IF EXISTS "article_revisions_articleId_fkey";
ALTER TABLE "article_categories" DROP CONSTRAINT IF EXISTS "article_categories_tenantId_fkey";
ALTER TABLE "article_templates" DROP CONSTRAINT IF EXISTS "article_templates_tenantId_fkey";

-- 2. 删 INDEX
DROP INDEX IF EXISTS "articles_tenantId_authorizerId_idx";
DROP INDEX IF EXISTS "articles_authorizerId_status_idx";
DROP INDEX IF EXISTS "articles_authorizerId_scheduledAt_idx";
DROP INDEX IF EXISTS "article_revisions_articleId_version_idx";
DROP INDEX IF EXISTS "article_categories_tenantId_idx";
DROP INDEX IF EXISTS "article_categories_tenantId_name_key";
DROP INDEX IF EXISTS "article_templates_tenantId_idx";
DROP INDEX IF EXISTS "article_templates_category_idx";

-- 3. 删表 (逆序)
DROP TABLE IF EXISTS "article_templates" CASCADE;
DROP TABLE IF EXISTS "article_categories" CASCADE;
DROP TABLE IF EXISTS "article_revisions" CASCADE;
DROP TABLE IF EXISTS "articles" CASCADE;
