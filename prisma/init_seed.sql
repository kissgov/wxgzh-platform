-- =============================================
-- 种子数据
-- 默认管理员: admin@wxgzh.com / admin123
-- =============================================

INSERT INTO "permissions" (id, slug, name, resource, action) VALUES
('perm_platform_read', 'platform:read', '查看平台配置', 'platform', 'read'),
('perm_platform_create', 'platform:create', '生成授权链接', 'platform', 'create'),
('perm_platform_delete', 'platform:delete', '回收授权', 'platform', 'delete'),
('perm_account_read', 'account:read', '查看公众号列表', 'account', 'read'),
('perm_account_create', 'account:create', '创建分组', 'account', 'create'),
('perm_account_update', 'account:update', '编辑分组', 'account', 'update'),
('perm_account_delete', 'account:delete', '删除分组', 'account', 'delete'),
('perm_follower_read', 'follower:read', '查看粉丝列表', 'follower', 'read'),
('perm_follower_create', 'follower:create', '创建标签', 'follower', 'create'),
('perm_follower_update', 'follower:update', '编辑粉丝备注', 'follower', 'update'),
('perm_follower_delete', 'follower:delete', '移除粉丝', 'follower', 'delete'),
('perm_follower_tag', 'follower:tag', '管理粉丝标签', 'follower', 'tag'),
('perm_follower_blacklist', 'follower:blacklist', '管理黑名单', 'follower', 'blacklist'),
('perm_message_read', 'message:read', '查看消息记录', 'message', 'read'),
('perm_message_create', 'message:create', '创建自动回复', 'message', 'create'),
('perm_message_update', 'message:update', '编辑自动回复', 'message', 'update'),
('perm_message_delete', 'message:delete', '删除自动回复', 'message', 'delete'),
('perm_message_broadcast', 'message:broadcast', '群发消息', 'message', 'broadcast'),
('perm_material_read', 'material:read', '查看素材库', 'material', 'read'),
('perm_material_create', 'material:create', '创建素材', 'material', 'create'),
('perm_material_update', 'material:update', '编辑素材信息', 'material', 'update'),
('perm_material_delete', 'material:delete', '删除素材', 'material', 'delete'),
('perm_material_upload', 'material:upload', '上传素材文件', 'material', 'upload'),
('perm_menu_read', 'menu:read', '查看菜单配置', 'menu', 'read'),
('perm_menu_create', 'menu:create', '编辑菜单草稿', 'menu', 'create'),
('perm_menu_update', 'menu:update', '更新菜单', 'menu', 'update'),
('perm_menu_delete', 'menu:delete', '删除菜单模板', 'menu', 'delete'),
('perm_menu_publish', 'menu:publish', '发布菜单到微信', 'menu', 'publish'),
('perm_analytics_read', 'analytics:read', '查看数据报表', 'analytics', 'read'),
('perm_analytics_export', 'analytics:export', '导出分析报告', 'analytics', 'export');

INSERT INTO "tenants" (id, name, slug, contact, status, plan, "billingPeriod", "maxAuthorizers", "maxUsers", "trialEndsAt", "createdAt", "updatedAt") VALUES
('tenant_default', '默认租户', 'default', '管理员', 'active', 'free', 'trial', 2, 5, NOW() + INTERVAL '14 days', NOW(), NOW());

INSERT INTO "roles" (id, "tenantId", name, slug, description, "isSystem", "isDefault", "createdAt", "updatedAt") VALUES
('role_super_admin', 'tenant_default', '超级管理员', 'super_admin', '系统最高权限', true, false, NOW(), NOW()),
('role_admin', 'tenant_default', '管理员', 'admin', '租户管理员', true, false, NOW(), NOW()),
('role_editor', 'tenant_default', '运营编辑', 'editor', '内容运营', true, true, NOW(), NOW()),
('role_analyst', 'tenant_default', '数据分析师', 'analyst', '数据分析', true, false, NOW(), NOW()),
('role_cs', 'tenant_default', '客服', 'cs', '客户服务', true, false, NOW(), NOW());

INSERT INTO "role_permissions" ("roleId", "permissionId") SELECT 'role_super_admin', id FROM "permissions";

INSERT INTO "role_permissions" ("roleId", "permissionId") VALUES
('role_admin', 'perm_platform_read'), ('role_admin', 'perm_platform_create'),
('role_admin', 'perm_account_read'), ('role_admin', 'perm_account_create'),
('role_admin', 'perm_account_update'), ('role_admin', 'perm_account_delete'),
('role_admin', 'perm_follower_read'), ('role_admin', 'perm_follower_tag'),
('role_admin', 'perm_follower_blacklist'), ('role_admin', 'perm_message_read'),
('role_admin', 'perm_message_create'), ('role_admin', 'perm_message_update'),
('role_admin', 'perm_message_broadcast'), ('role_admin', 'perm_material_read'),
('role_admin', 'perm_material_create'), ('role_admin', 'perm_material_update'),
('role_admin', 'perm_material_upload'), ('role_admin', 'perm_menu_read'),
('role_admin', 'perm_menu_create'), ('role_admin', 'perm_menu_update'),
('role_admin', 'perm_menu_publish'), ('role_admin', 'perm_analytics_read'),
('role_admin', 'perm_analytics_export'),
('role_editor', 'perm_follower_read'), ('role_editor', 'perm_follower_tag'),
('role_editor', 'perm_message_read'), ('role_editor', 'perm_message_create'),
('role_editor', 'perm_message_update'), ('role_editor', 'perm_material_read'),
('role_editor', 'perm_material_create'), ('role_editor', 'perm_material_upload'),
('role_editor', 'perm_menu_read'), ('role_editor', 'perm_analytics_read'),
('role_analyst', 'perm_follower_read'), ('role_analyst', 'perm_message_read'),
('role_analyst', 'perm_analytics_read'), ('role_analyst', 'perm_analytics_export'),
('role_cs', 'perm_follower_read'), ('role_cs', 'perm_follower_tag'),
('role_cs', 'perm_message_read'), ('role_cs', 'perm_message_create'),
('role_cs', 'perm_material_read');

INSERT INTO "users" (id, "tenantId", email, "passwordHash", name, status, "createdAt", "updatedAt") VALUES
('user_admin', 'tenant_default', 'admin@wxgzh.com', '$2a$12$LJ3m4ys3GZfnYMz8kVsKaOTSxGHLFhQaBzKJL99rqIJUqQCMwDVqW', '系统管理员', 'active', NOW(), NOW());

INSERT INTO "user_roles" ("userId", "roleId") VALUES ('user_admin', 'role_super_admin');

INSERT INTO "subscription_plans" (id, slug, name, description, "priceMonthly", "priceQuarterly", "priceYearly", "maxAuthorizers", "maxUsers", "trialDays", features, "sortOrder", status, "createdAt", "updatedAt") VALUES
('plan_free', 'free', '免费版', '适合个人和小团队起步使用', 0, 0, 0, 2, 5, 14, '["2个公众号","5个用户","基础分析","7天消息记录"]', 1, 'active', NOW(), NOW()),
('plan_starter', 'starter', '入门版', '适合小型代运营团队', 9900, 26800, 94900, 10, 20, 14, '["10个公众号","20个用户","高级分析","30天消息记录","自动标签规则"]', 2, 'active', NOW(), NOW()),
('plan_pro', 'pro', '专业版', '适合中型代运营公司', 29900, 79800, 287900, 50, 100, 14, '["50个公众号","100个用户","全部分析","无限消息记录","批量操作","数据导出","API访问"]', 3, 'active', NOW(), NOW()),
('plan_enterprise', 'enterprise', '企业版', '适合大型机构及定制需求', 99900, 269900, 959900, 200, 500, 30, '["200个公众号","500个用户","全部功能","专属支持","SSO集成","审计日志","SLA保障"]', 4, 'active', NOW(), NOW());
