-- WXGZH Platform — PostgreSQL 初始化脚本
-- ============================================================================

-- 启用扩展
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 注释
COMMENT ON DATABASE wxgzh_dev IS '微信公众号第三方运营管理平台 — 开发数据库';
