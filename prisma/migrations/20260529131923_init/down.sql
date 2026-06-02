-- 20260529131923_init / down.sql
-- 逆序删表, 用 CASCADE 一次清掉所有 FK / INDEX / 约束。
-- (该 migration 是 V1 初始, 后续 V1 migrations 只往这些表 ADD COLUMN/INDEX,
--  不会改变主结构, 所以 CASCADE 干净。)

-- ── 1. 先删所有 FK (显式, 便于 audit) ─────────────────────────────
ALTER TABLE "users"                DROP CONSTRAINT IF EXISTS "users_tenantId_fkey";
ALTER TABLE "user_roles"           DROP CONSTRAINT IF EXISTS "user_roles_userId_fkey";
ALTER TABLE "user_roles"           DROP CONSTRAINT IF EXISTS "user_roles_roleId_fkey";
ALTER TABLE "role_permissions"     DROP CONSTRAINT IF EXISTS "role_permissions_roleId_fkey";
ALTER TABLE "role_permissions"     DROP CONSTRAINT IF EXISTS "role_permissions_permissionId_fkey";
ALTER TABLE "audit_logs"           DROP CONSTRAINT IF EXISTS "audit_logs_userId_fkey";
ALTER TABLE "authorizers"          DROP CONSTRAINT IF EXISTS "authorizers_tenantId_fkey";
ALTER TABLE "authorizers"          DROP CONSTRAINT IF EXISTS "authorizers_componentAppId_fkey";
ALTER TABLE "auth_events"          DROP CONSTRAINT IF EXISTS "auth_events_componentAppId_fkey";
ALTER TABLE "auth_events"          DROP CONSTRAINT IF EXISTS "auth_events_authorizerId_fkey";
ALTER TABLE "account_groups"       DROP CONSTRAINT IF EXISTS "account_groups_tenantId_fkey";
ALTER TABLE "account_groups"       DROP CONSTRAINT IF EXISTS "account_groups_parentId_fkey";
ALTER TABLE "account_group_items"  DROP CONSTRAINT IF EXISTS "account_group_items_groupId_fkey";
ALTER TABLE "account_group_items"  DROP CONSTRAINT IF EXISTS "account_group_items_authorizerId_fkey";
ALTER TABLE "followers"            DROP CONSTRAINT IF EXISTS "followers_tenantId_fkey";
ALTER TABLE "followers"            DROP CONSTRAINT IF EXISTS "followers_authorizerId_fkey";
ALTER TABLE "follower_tag_relations" DROP CONSTRAINT IF EXISTS "follower_tag_relations_followerId_fkey";
ALTER TABLE "follower_tag_relations" DROP CONSTRAINT IF EXISTS "follower_tag_relations_tagId_fkey";
ALTER TABLE "tag_rules"            DROP CONSTRAINT IF EXISTS "tag_rules_targetTagId_fkey";
ALTER TABLE "tag_rule_execution_logs" DROP CONSTRAINT IF EXISTS "tag_rule_execution_logs_ruleId_fkey";
ALTER TABLE "blacklists"           DROP CONSTRAINT IF EXISTS "blacklists_followerId_fkey";
ALTER TABLE "auto_reply_rules"     DROP CONSTRAINT IF EXISTS "auto_reply_rules_authorizerId_fkey";
ALTER TABLE "keyword_replies"      DROP CONSTRAINT IF EXISTS "keyword_replies_ruleId_fkey";
ALTER TABLE "reply_contents"       DROP CONSTRAINT IF EXISTS "reply_contents_ruleId_fkey";
ALTER TABLE "broadcast_messages"   DROP CONSTRAINT IF EXISTS "broadcast_messages_tenantId_fkey";
ALTER TABLE "broadcast_messages"   DROP CONSTRAINT IF EXISTS "broadcast_messages_authorizerId_fkey";
ALTER TABLE "message_logs"         DROP CONSTRAINT IF EXISTS "message_logs_followerId_fkey";
ALTER TABLE "materials"            DROP CONSTRAINT IF EXISTS "materials_tenantId_fkey";
ALTER TABLE "material_usage_logs"  DROP CONSTRAINT IF EXISTS "material_usage_logs_materialId_fkey";
ALTER TABLE "menu_configs"         DROP CONSTRAINT IF EXISTS "menu_configs_authorizerId_fkey";
ALTER TABLE "menu_publish_history" DROP CONSTRAINT IF EXISTS "menu_publish_history_menuConfigId_fkey";
ALTER TABLE "sync_tasks"           DROP CONSTRAINT IF EXISTS "sync_tasks_authorizerId_fkey";
ALTER TABLE "follower_stats"       DROP CONSTRAINT IF EXISTS "follower_stats_authorizerId_fkey";
ALTER TABLE "message_stats"        DROP CONSTRAINT IF EXISTS "message_stats_authorizerId_fkey";
ALTER TABLE "news_stats"           DROP CONSTRAINT IF EXISTS "news_stats_authorizerId_fkey";

-- ── 2. 删表 (逆序, CASCADE 清掉残留的 unique index / 约束) ───────────
DROP TABLE IF EXISTS "dashboard_caches"    CASCADE;
DROP TABLE IF EXISTS "news_stats"          CASCADE;
DROP TABLE IF EXISTS "message_stats"       CASCADE;
DROP TABLE IF EXISTS "follower_stats"      CASCADE;
DROP TABLE IF EXISTS "sync_tasks"          CASCADE;
DROP TABLE IF EXISTS "menu_publish_history" CASCADE;
DROP TABLE IF EXISTS "menu_templates"      CASCADE;
DROP TABLE IF EXISTS "menu_configs"        CASCADE;
DROP TABLE IF EXISTS "material_usage_logs" CASCADE;
DROP TABLE IF EXISTS "materials"           CASCADE;
DROP TABLE IF EXISTS "template_messages"   CASCADE;
DROP TABLE IF EXISTS "message_logs"        CASCADE;
DROP TABLE IF EXISTS "broadcast_messages"  CASCADE;
DROP TABLE IF EXISTS "reply_contents"      CASCADE;
DROP TABLE IF EXISTS "keyword_replies"     CASCADE;
DROP TABLE IF EXISTS "auto_reply_rules"    CASCADE;
DROP TABLE IF EXISTS "blacklists"          CASCADE;
DROP TABLE IF EXISTS "tag_rule_execution_logs" CASCADE;
DROP TABLE IF EXISTS "tag_rules"           CASCADE;
DROP TABLE IF EXISTS "follower_tag_relations" CASCADE;
DROP TABLE IF EXISTS "follower_tags"       CASCADE;
DROP TABLE IF EXISTS "followers"           CASCADE;
DROP TABLE IF EXISTS "account_group_items" CASCADE;
DROP TABLE IF EXISTS "account_groups"      CASCADE;
DROP TABLE IF EXISTS "auth_events"         CASCADE;
DROP TABLE IF EXISTS "authorizers"         CASCADE;
DROP TABLE IF EXISTS "component_apps"      CASCADE;
DROP TABLE IF EXISTS "audit_logs"          CASCADE;
DROP TABLE IF EXISTS "role_permissions"    CASCADE;
DROP TABLE IF EXISTS "permissions"         CASCADE;
DROP TABLE IF EXISTS "user_roles"          CASCADE;
DROP TABLE IF EXISTS "roles"               CASCADE;
DROP TABLE IF EXISTS "users"               CASCADE;
DROP TABLE IF EXISTS "tenants"             CASCADE;
