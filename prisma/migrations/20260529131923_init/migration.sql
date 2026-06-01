-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "contact" TEXT,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "detail" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "component_apps" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "appSecret" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "encodingAesKey" TEXT NOT NULL,
    "verifyTicket" TEXT,
    "accessToken" TEXT,
    "tokenExpireAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "component_apps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authorizers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "componentAppId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "appType" INTEGER NOT NULL,
    "nickName" TEXT NOT NULL,
    "headImg" TEXT,
    "qrcodeUrl" TEXT,
    "principalName" TEXT,
    "signature" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpireAt" TIMESTAMP(3),
    "funcInfo" JSONB NOT NULL,
    "serviceInfo" JSONB,
    "verifyInfo" JSONB,
    "status" TEXT NOT NULL DEFAULT 'authorized',
    "authorizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiredAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "authorizers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_events" (
    "id" TEXT NOT NULL,
    "componentAppId" TEXT NOT NULL,
    "authorizerId" TEXT,
    "eventType" TEXT NOT NULL,
    "rawXml" TEXT,
    "processed" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_groups" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "account_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_group_items" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "authorizerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_group_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "followers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "authorizerId" TEXT NOT NULL,
    "openid" TEXT NOT NULL,
    "unionid" TEXT,
    "nickname" TEXT,
    "headImg" TEXT,
    "sex" INTEGER,
    "country" TEXT,
    "province" TEXT,
    "city" TEXT,
    "subscribe" BOOLEAN NOT NULL DEFAULT true,
    "subscribeAt" TIMESTAMP(3),
    "unsubscribeAt" TIMESTAMP(3),
    "subscribeScene" TEXT,
    "qrScene" TEXT,
    "qrSceneStr" TEXT,
    "interactCount" INTEGER NOT NULL DEFAULT 0,
    "lastInteractAt" TIMESTAMP(3),
    "remark" TEXT,
    "extra" JSONB,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "followers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follower_tags" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "authorizerId" TEXT NOT NULL,
    "wechatTagId" INTEGER,
    "name" TEXT NOT NULL,
    "color" TEXT DEFAULT '#1677FF',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "follower_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follower_tag_relations" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follower_tag_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag_rules" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "authorizerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "conditions" JSONB NOT NULL,
    "logic" TEXT NOT NULL DEFAULT 'AND',
    "targetTagId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'enabled',
    "lastExecAt" TIMESTAMP(3),
    "lastExecCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tag_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag_rule_execution_logs" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "affectedCount" INTEGER NOT NULL,
    "taggedCount" INTEGER NOT NULL,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tag_rule_execution_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blacklists" (
    "id" TEXT NOT NULL,
    "authorizerId" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blacklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auto_reply_rules" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "authorizerId" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'enabled',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "auto_reply_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keyword_replies" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "matchType" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "keyword_replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reply_contents" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reply_contents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broadcast_messages" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "authorizerId" TEXT NOT NULL,
    "msgType" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "targetType" TEXT NOT NULL DEFAULT 'all',
    "targetConfig" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "wechatMsgId" TEXT,
    "wechatMsgDataId" TEXT,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "broadcast_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_logs" (
    "id" TEXT NOT NULL,
    "authorizerId" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "msgId" TEXT,
    "msgType" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "content" TEXT,
    "mediaId" TEXT,
    "event" TEXT,
    "eventKey" TEXT,
    "replyRuleId" TEXT,
    "rawXml" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_messages" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "authorizerId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "industry" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materials" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "authorizerId" TEXT,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mediaId" TEXT,
    "url" TEXT NOT NULL,
    "thumbUrl" TEXT,
    "fileSize" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "duration" INTEGER,
    "format" TEXT,
    "category" TEXT NOT NULL DEFAULT 'uncategorized',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "isSynced" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_usage_logs" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "usedIn" TEXT NOT NULL,
    "usedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "authorizerId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "menuJson" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_templates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "menuJson" JSONB NOT NULL,
    "category" TEXT,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "menu_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_publish_history" (
    "id" TEXT NOT NULL,
    "menuConfigId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "menuJson" JSONB NOT NULL,
    "publishedBy" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "menu_publish_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_tasks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "authorizerId" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "params" JSONB,
    "result" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follower_stats" (
    "id" TEXT NOT NULL,
    "authorizerId" TEXT NOT NULL,
    "statDate" TIMESTAMP(3) NOT NULL,
    "newSubscribers" INTEGER NOT NULL DEFAULT 0,
    "unsubscribers" INTEGER NOT NULL DEFAULT 0,
    "netGrowth" INTEGER NOT NULL DEFAULT 0,
    "totalFollowers" INTEGER NOT NULL DEFAULT 0,
    "sourceData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follower_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_stats" (
    "id" TEXT NOT NULL,
    "authorizerId" TEXT NOT NULL,
    "statDate" TIMESTAMP(3) NOT NULL,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "receivedCount" INTEGER NOT NULL DEFAULT 0,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "replyRate" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_stats" (
    "id" TEXT NOT NULL,
    "authorizerId" TEXT NOT NULL,
    "statDate" TIMESTAMP(3) NOT NULL,
    "msgid" TEXT,
    "title" TEXT,
    "readCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "favorCount" INTEGER NOT NULL DEFAULT 0,
    "shareCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "readSourceData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_caches" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "authorizerId" TEXT NOT NULL,
    "cacheType" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "cacheData" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dashboard_caches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "users_tenantId_idx" ON "users"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenantId_email_key" ON "users"("tenantId", "email");

-- CreateIndex
CREATE INDEX "roles_tenantId_idx" ON "roles"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_tenantId_slug_key" ON "roles"("tenantId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_userId_roleId_key" ON "user_roles"("userId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_slug_key" ON "permissions"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_roleId_permissionId_key" ON "role_permissions"("roleId", "permissionId");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_createdAt_idx" ON "audit_logs"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_action_idx" ON "audit_logs"("tenantId", "action");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "component_apps_appId_key" ON "component_apps"("appId");

-- CreateIndex
CREATE UNIQUE INDEX "authorizers_appId_key" ON "authorizers"("appId");

-- CreateIndex
CREATE INDEX "authorizers_tenantId_idx" ON "authorizers"("tenantId");

-- CreateIndex
CREATE INDEX "authorizers_tenantId_status_idx" ON "authorizers"("tenantId", "status");

-- CreateIndex
CREATE INDEX "authorizers_componentAppId_idx" ON "authorizers"("componentAppId");

-- CreateIndex
CREATE INDEX "auth_events_componentAppId_createdAt_idx" ON "auth_events"("componentAppId", "createdAt");

-- CreateIndex
CREATE INDEX "auth_events_authorizerId_idx" ON "auth_events"("authorizerId");

-- CreateIndex
CREATE INDEX "account_groups_tenantId_idx" ON "account_groups"("tenantId");

-- CreateIndex
CREATE INDEX "account_groups_tenantId_parentId_idx" ON "account_groups"("tenantId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "account_group_items_groupId_authorizerId_key" ON "account_group_items"("groupId", "authorizerId");

-- CreateIndex
CREATE INDEX "followers_tenantId_authorizerId_idx" ON "followers"("tenantId", "authorizerId");

-- CreateIndex
CREATE INDEX "followers_authorizerId_subscribe_idx" ON "followers"("authorizerId", "subscribe");

-- CreateIndex
CREATE INDEX "followers_authorizerId_subscribeAt_idx" ON "followers"("authorizerId", "subscribeAt");

-- CreateIndex
CREATE INDEX "followers_tenantId_authorizerId_subscribeAt_idx" ON "followers"("tenantId", "authorizerId", "subscribeAt");

-- CreateIndex
CREATE INDEX "followers_openid_unionid_idx" ON "followers"("openid", "unionid");

-- CreateIndex
CREATE INDEX "followers_createdAt_idx" ON "followers" USING BRIN ("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "followers_authorizerId_openid_key" ON "followers"("authorizerId", "openid");

-- CreateIndex
CREATE INDEX "follower_tags_tenantId_authorizerId_idx" ON "follower_tags"("tenantId", "authorizerId");

-- CreateIndex
CREATE UNIQUE INDEX "follower_tags_authorizerId_name_key" ON "follower_tags"("authorizerId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "follower_tag_relations_followerId_tagId_key" ON "follower_tag_relations"("followerId", "tagId");

-- CreateIndex
CREATE INDEX "tag_rules_tenantId_authorizerId_idx" ON "tag_rules"("tenantId", "authorizerId");

-- CreateIndex
CREATE INDEX "tag_rules_authorizerId_status_idx" ON "tag_rules"("authorizerId", "status");

-- CreateIndex
CREATE INDEX "tag_rule_execution_logs_ruleId_createdAt_idx" ON "tag_rule_execution_logs"("ruleId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "blacklists_followerId_key" ON "blacklists"("followerId");

-- CreateIndex
CREATE UNIQUE INDEX "blacklists_authorizerId_followerId_key" ON "blacklists"("authorizerId", "followerId");

-- CreateIndex
CREATE INDEX "auto_reply_rules_tenantId_authorizerId_idx" ON "auto_reply_rules"("tenantId", "authorizerId");

-- CreateIndex
CREATE INDEX "auto_reply_rules_authorizerId_ruleType_status_idx" ON "auto_reply_rules"("authorizerId", "ruleType", "status");

-- CreateIndex
CREATE INDEX "keyword_replies_ruleId_idx" ON "keyword_replies"("ruleId");

-- CreateIndex
CREATE INDEX "reply_contents_ruleId_idx" ON "reply_contents"("ruleId");

-- CreateIndex
CREATE INDEX "broadcast_messages_tenantId_authorizerId_idx" ON "broadcast_messages"("tenantId", "authorizerId");

-- CreateIndex
CREATE INDEX "broadcast_messages_authorizerId_status_idx" ON "broadcast_messages"("authorizerId", "status");

-- CreateIndex
CREATE INDEX "broadcast_messages_scheduledAt_idx" ON "broadcast_messages"("scheduledAt");

-- CreateIndex
CREATE INDEX "message_logs_authorizerId_createdAt_idx" ON "message_logs"("authorizerId", "createdAt");

-- CreateIndex
CREATE INDEX "message_logs_followerId_createdAt_idx" ON "message_logs"("followerId", "createdAt");

-- CreateIndex
CREATE INDEX "message_logs_createdAt_idx" ON "message_logs" USING BRIN ("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "message_logs_msgId_key" ON "message_logs"("msgId");

-- CreateIndex
CREATE INDEX "template_messages_tenantId_authorizerId_idx" ON "template_messages"("tenantId", "authorizerId");

-- CreateIndex
CREATE UNIQUE INDEX "template_messages_authorizerId_templateId_key" ON "template_messages"("authorizerId", "templateId");

-- CreateIndex
CREATE INDEX "materials_tenantId_type_idx" ON "materials"("tenantId", "type");

-- CreateIndex
CREATE INDEX "materials_tenantId_category_idx" ON "materials"("tenantId", "category");

-- CreateIndex
CREATE INDEX "materials_mediaId_idx" ON "materials"("mediaId");

-- CreateIndex
CREATE INDEX "material_usage_logs_materialId_idx" ON "material_usage_logs"("materialId");

-- CreateIndex
CREATE INDEX "material_usage_logs_usedIn_usedById_idx" ON "material_usage_logs"("usedIn", "usedById");

-- CreateIndex
CREATE INDEX "menu_configs_tenantId_authorizerId_idx" ON "menu_configs"("tenantId", "authorizerId");

-- CreateIndex
CREATE INDEX "menu_configs_authorizerId_status_idx" ON "menu_configs"("authorizerId", "status");

-- CreateIndex
CREATE INDEX "menu_templates_tenantId_idx" ON "menu_templates"("tenantId");

-- CreateIndex
CREATE INDEX "menu_templates_category_idx" ON "menu_templates"("category");

-- CreateIndex
CREATE INDEX "menu_publish_history_menuConfigId_publishedAt_idx" ON "menu_publish_history"("menuConfigId", "publishedAt");

-- CreateIndex
CREATE INDEX "sync_tasks_tenantId_authorizerId_idx" ON "sync_tasks"("tenantId", "authorizerId");

-- CreateIndex
CREATE INDEX "sync_tasks_authorizerId_taskType_status_idx" ON "sync_tasks"("authorizerId", "taskType", "status");

-- CreateIndex
CREATE INDEX "sync_tasks_createdAt_idx" ON "sync_tasks"("createdAt");

-- CreateIndex
CREATE INDEX "follower_stats_authorizerId_statDate_idx" ON "follower_stats"("authorizerId", "statDate");

-- CreateIndex
CREATE UNIQUE INDEX "follower_stats_authorizerId_statDate_key" ON "follower_stats"("authorizerId", "statDate");

-- CreateIndex
CREATE INDEX "message_stats_authorizerId_statDate_idx" ON "message_stats"("authorizerId", "statDate");

-- CreateIndex
CREATE UNIQUE INDEX "message_stats_authorizerId_statDate_key" ON "message_stats"("authorizerId", "statDate");

-- CreateIndex
CREATE INDEX "news_stats_authorizerId_statDate_idx" ON "news_stats"("authorizerId", "statDate");

-- CreateIndex
CREATE INDEX "news_stats_msgid_idx" ON "news_stats"("msgid");

-- CreateIndex
CREATE INDEX "dashboard_caches_expiresAt_idx" ON "dashboard_caches"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_caches_authorizerId_cacheType_cacheKey_key" ON "dashboard_caches"("authorizerId", "cacheType", "cacheKey");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authorizers" ADD CONSTRAINT "authorizers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authorizers" ADD CONSTRAINT "authorizers_componentAppId_fkey" FOREIGN KEY ("componentAppId") REFERENCES "component_apps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_events" ADD CONSTRAINT "auth_events_componentAppId_fkey" FOREIGN KEY ("componentAppId") REFERENCES "component_apps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_events" ADD CONSTRAINT "auth_events_authorizerId_fkey" FOREIGN KEY ("authorizerId") REFERENCES "authorizers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_groups" ADD CONSTRAINT "account_groups_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_groups" ADD CONSTRAINT "account_groups_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "account_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_group_items" ADD CONSTRAINT "account_group_items_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "account_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_group_items" ADD CONSTRAINT "account_group_items_authorizerId_fkey" FOREIGN KEY ("authorizerId") REFERENCES "authorizers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followers" ADD CONSTRAINT "followers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followers" ADD CONSTRAINT "followers_authorizerId_fkey" FOREIGN KEY ("authorizerId") REFERENCES "authorizers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follower_tag_relations" ADD CONSTRAINT "follower_tag_relations_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "followers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follower_tag_relations" ADD CONSTRAINT "follower_tag_relations_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "follower_tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_rules" ADD CONSTRAINT "tag_rules_targetTagId_fkey" FOREIGN KEY ("targetTagId") REFERENCES "follower_tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_rule_execution_logs" ADD CONSTRAINT "tag_rule_execution_logs_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "tag_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blacklists" ADD CONSTRAINT "blacklists_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "followers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_reply_rules" ADD CONSTRAINT "auto_reply_rules_authorizerId_fkey" FOREIGN KEY ("authorizerId") REFERENCES "authorizers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keyword_replies" ADD CONSTRAINT "keyword_replies_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "auto_reply_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reply_contents" ADD CONSTRAINT "reply_contents_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "auto_reply_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcast_messages" ADD CONSTRAINT "broadcast_messages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcast_messages" ADD CONSTRAINT "broadcast_messages_authorizerId_fkey" FOREIGN KEY ("authorizerId") REFERENCES "authorizers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_logs" ADD CONSTRAINT "message_logs_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "followers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_usage_logs" ADD CONSTRAINT "material_usage_logs_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_configs" ADD CONSTRAINT "menu_configs_authorizerId_fkey" FOREIGN KEY ("authorizerId") REFERENCES "authorizers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_publish_history" ADD CONSTRAINT "menu_publish_history_menuConfigId_fkey" FOREIGN KEY ("menuConfigId") REFERENCES "menu_configs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_tasks" ADD CONSTRAINT "sync_tasks_authorizerId_fkey" FOREIGN KEY ("authorizerId") REFERENCES "authorizers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follower_stats" ADD CONSTRAINT "follower_stats_authorizerId_fkey" FOREIGN KEY ("authorizerId") REFERENCES "authorizers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_stats" ADD CONSTRAINT "message_stats_authorizerId_fkey" FOREIGN KEY ("authorizerId") REFERENCES "authorizers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_stats" ADD CONSTRAINT "news_stats_authorizerId_fkey" FOREIGN KEY ("authorizerId") REFERENCES "authorizers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
