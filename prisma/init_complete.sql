-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "contact" TEXT,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "config" JSONB,
    "plan" TEXT DEFAULT 'free',
    "billingPeriod" TEXT DEFAULT 'trial',
    "maxAuthorizers" INTEGER NOT NULL DEFAULT 2,
    "maxUsers" INTEGER NOT NULL DEFAULT 5,
    "subscriptionExpiresAt" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
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

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "roleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "authorizerIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_workflows" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "authorizerId" TEXT,
    "name" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "steps" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'enabled',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "approval_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "submitterId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_steps" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "approverId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "comment" TEXT,
    "actedAt" TIMESTAMP(3),

    CONSTRAINT "approval_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_activities" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "articles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "authorizerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "digest" TEXT,
    "content" TEXT,
    "contentType" TEXT NOT NULL DEFAULT 'html',
    "coverMediaId" TEXT,
    "coverUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "wechatMsgId" TEXT,
    "categoryId" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_revisions" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "digest" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_categories" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "article_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_templates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "content" TEXT,
    "coverUrl" TEXT,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "article_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "authorizerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "config" JSONB,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_stats" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "participants" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_qr_codes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "authorizerId" TEXT NOT NULL,
    "campaignId" TEXT,
    "name" TEXT NOT NULL,
    "sceneStr" TEXT NOT NULL,
    "ticket" TEXT,
    "qrUrl" TEXT,
    "expireAt" TIMESTAMP(3),
    "scanCount" INTEGER NOT NULL DEFAULT 0,
    "subscribeCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "channel_qr_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qr_code_scans" (
    "id" TEXT NOT NULL,
    "qrCodeId" TEXT NOT NULL,
    "openid" TEXT,
    "event" TEXT NOT NULL DEFAULT 'SCAN',
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qr_code_scans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversion_funnels" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "authorizerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "steps" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "conversion_funnels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rfm_segments" (
    "id" TEXT NOT NULL,
    "authorizerId" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "recencyScore" INTEGER NOT NULL,
    "frequencyScore" INTEGER NOT NULL,
    "monetaryScore" INTEGER NOT NULL,
    "segment" TEXT NOT NULL,
    "segmentLabel" TEXT,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rfm_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follower_events" (
    "id" TEXT NOT NULL,
    "authorizerId" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventData" JSONB,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follower_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cohort_retentions" (
    "id" TEXT NOT NULL,
    "authorizerId" TEXT NOT NULL,
    "cohortDate" TIMESTAMP(3) NOT NULL,
    "cohortSize" INTEGER NOT NULL,
    "period" INTEGER NOT NULL,
    "retained" INTEGER NOT NULL,
    "retentionRate" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cohort_retentions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'openai',
    "apiKey" TEXT,
    "apiUrl" TEXT,
    "model" TEXT NOT NULL DEFAULT 'gpt-4o',
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "maxTokens" INTEGER NOT NULL DEFAULT 4096,
    "systemPrompt" TEXT,
    "dailyLimit" INTEGER NOT NULL DEFAULT 100,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "llm_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_usage_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "scene" TEXT NOT NULL,
    "prompt" TEXT,
    "completion" TEXT,
    "model" TEXT NOT NULL,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'success',
    "errorMsg" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skills" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT NOT NULL DEFAULT 'RobotOutlined',
    "prompt" TEXT NOT NULL,
    "inputSchema" JSONB,
    "outputSchema" JSONB,
    "category" TEXT NOT NULL DEFAULT 'general',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "avatar" TEXT NOT NULL DEFAULT 'RobotOutlined',
    "systemPrompt" TEXT,
    "config" JSONB,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_skills" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB,

    CONSTRAINT "agent_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_tasks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "skillId" TEXT,
    "name" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "output" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMsg" TEXT,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "agent_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_authorizers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "authorizerId" TEXT NOT NULL,
    "authorizerRole" TEXT NOT NULL DEFAULT 'editor',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_authorizers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceMonthly" INTEGER NOT NULL DEFAULT 0,
    "priceQuarterly" INTEGER NOT NULL DEFAULT 0,
    "priceYearly" INTEGER NOT NULL DEFAULT 0,
    "maxAuthorizers" INTEGER NOT NULL DEFAULT 2,
    "maxUsers" INTEGER NOT NULL DEFAULT 5,
    "trialDays" INTEGER NOT NULL DEFAULT 14,
    "features" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_records" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_orders" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'wechat',
    "tradeNo" TEXT,
    "qrCodeUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'mock',
    "wechatAppId" TEXT,
    "wechatMchId" TEXT,
    "wechatApiKey" TEXT,
    "wechatCertPath" TEXT,
    "alipayAppId" TEXT,
    "alipayPid" TEXT,
    "alipayPrivateKey" TEXT,
    "alipayPublicKey" TEXT,
    "thirdpartyGateway" TEXT,
    "thirdpartyAppId" TEXT,
    "thirdpartyAppKey" TEXT,
    "thirdpartyApiUrl" TEXT,
    "thirdpartyNotifyUrl" TEXT,
    "mockSuccess" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_configs_pkey" PRIMARY KEY ("id")
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

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_key" ON "invitations"("token");

-- CreateIndex
CREATE INDEX "invitations_tenantId_status_idx" ON "invitations"("tenantId", "status");

-- CreateIndex
CREATE INDEX "invitations_email_idx" ON "invitations"("email");

-- CreateIndex
CREATE INDEX "approval_workflows_tenantId_idx" ON "approval_workflows"("tenantId");

-- CreateIndex
CREATE INDEX "approval_workflows_tenantId_resourceType_idx" ON "approval_workflows"("tenantId", "resourceType");

-- CreateIndex
CREATE INDEX "approval_requests_tenantId_status_idx" ON "approval_requests"("tenantId", "status");

-- CreateIndex
CREATE INDEX "approval_requests_resourceType_resourceId_idx" ON "approval_requests"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "approval_requests_submitterId_idx" ON "approval_requests"("submitterId");

-- CreateIndex
CREATE INDEX "approval_steps_requestId_idx" ON "approval_steps"("requestId");

-- CreateIndex
CREATE INDEX "approval_steps_approverId_status_idx" ON "approval_steps"("approverId", "status");

-- CreateIndex
CREATE INDEX "team_activities_tenantId_createdAt_idx" ON "team_activities"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "articles_tenantId_authorizerId_idx" ON "articles"("tenantId", "authorizerId");

-- CreateIndex
CREATE INDEX "articles_authorizerId_status_idx" ON "articles"("authorizerId", "status");

-- CreateIndex
CREATE INDEX "articles_authorizerId_scheduledAt_idx" ON "articles"("authorizerId", "scheduledAt");

-- CreateIndex
CREATE INDEX "article_revisions_articleId_version_idx" ON "article_revisions"("articleId", "version");

-- CreateIndex
CREATE INDEX "article_categories_tenantId_idx" ON "article_categories"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "article_categories_tenantId_name_key" ON "article_categories"("tenantId", "name");

-- CreateIndex
CREATE INDEX "article_templates_tenantId_idx" ON "article_templates"("tenantId");

-- CreateIndex
CREATE INDEX "article_templates_category_idx" ON "article_templates"("category");

-- CreateIndex
CREATE INDEX "campaigns_tenantId_authorizerId_idx" ON "campaigns"("tenantId", "authorizerId");

-- CreateIndex
CREATE INDEX "campaigns_authorizerId_status_idx" ON "campaigns"("authorizerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_stats_campaignId_key" ON "campaign_stats"("campaignId");

-- CreateIndex
CREATE INDEX "channel_qr_codes_tenantId_authorizerId_idx" ON "channel_qr_codes"("tenantId", "authorizerId");

-- CreateIndex
CREATE INDEX "channel_qr_codes_campaignId_idx" ON "channel_qr_codes"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "channel_qr_codes_authorizerId_sceneStr_key" ON "channel_qr_codes"("authorizerId", "sceneStr");

-- CreateIndex
CREATE INDEX "qr_code_scans_qrCodeId_scannedAt_idx" ON "qr_code_scans"("qrCodeId", "scannedAt");

-- CreateIndex
CREATE INDEX "conversion_funnels_tenantId_authorizerId_idx" ON "conversion_funnels"("tenantId", "authorizerId");

-- CreateIndex
CREATE INDEX "rfm_segments_authorizerId_segment_idx" ON "rfm_segments"("authorizerId", "segment");

-- CreateIndex
CREATE UNIQUE INDEX "rfm_segments_followerId_key" ON "rfm_segments"("followerId");

-- CreateIndex
CREATE INDEX "follower_events_authorizerId_followerId_createdAt_idx" ON "follower_events"("authorizerId", "followerId", "createdAt");

-- CreateIndex
CREATE INDEX "follower_events_authorizerId_eventType_createdAt_idx" ON "follower_events"("authorizerId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "follower_events_createdAt_idx" ON "follower_events" USING BRIN ("createdAt");

-- CreateIndex
CREATE INDEX "cohort_retentions_authorizerId_cohortDate_idx" ON "cohort_retentions"("authorizerId", "cohortDate");

-- CreateIndex
CREATE UNIQUE INDEX "cohort_retentions_authorizerId_cohortDate_period_key" ON "cohort_retentions"("authorizerId", "cohortDate", "period");

-- CreateIndex
CREATE UNIQUE INDEX "llm_configs_tenantId_key" ON "llm_configs"("tenantId");

-- CreateIndex
CREATE INDEX "llm_usage_logs_tenantId_createdAt_idx" ON "llm_usage_logs"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "llm_usage_logs_configId_createdAt_idx" ON "llm_usage_logs"("configId", "createdAt");

-- CreateIndex
CREATE INDEX "skills_tenantId_category_idx" ON "skills"("tenantId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "skills_tenantId_slug_key" ON "skills"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "agents_tenantId_status_idx" ON "agents"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "agent_skills_agentId_skillId_key" ON "agent_skills"("agentId", "skillId");

-- CreateIndex
CREATE INDEX "agent_tasks_tenantId_agentId_createdAt_idx" ON "agent_tasks"("tenantId", "agentId", "createdAt");

-- CreateIndex
CREATE INDEX "agent_tasks_tenantId_status_idx" ON "agent_tasks"("tenantId", "status");

-- CreateIndex
CREATE INDEX "user_authorizers_tenantId_userId_idx" ON "user_authorizers"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_authorizers_userId_authorizerId_key" ON "user_authorizers"("userId", "authorizerId");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_slug_key" ON "subscription_plans"("slug");

-- CreateIndex
CREATE INDEX "subscription_records_tenantId_createdAt_idx" ON "subscription_records"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "payment_orders_tenantId_createdAt_idx" ON "payment_orders"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "payment_orders_tenantId_status_idx" ON "payment_orders"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payment_orders_tradeNo_key" ON "payment_orders"("tradeNo");

-- CreateIndex
CREATE UNIQUE INDEX "payment_configs_tenantId_key" ON "payment_configs"("tenantId");

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

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_workflows" ADD CONSTRAINT "approval_workflows_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "approval_workflows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "approval_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_activities" ADD CONSTRAINT "team_activities_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_activities" ADD CONSTRAINT "team_activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_authorizerId_fkey" FOREIGN KEY ("authorizerId") REFERENCES "authorizers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "article_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_revisions" ADD CONSTRAINT "article_revisions_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_categories" ADD CONSTRAINT "article_categories_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_templates" ADD CONSTRAINT "article_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_authorizerId_fkey" FOREIGN KEY ("authorizerId") REFERENCES "authorizers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_stats" ADD CONSTRAINT "campaign_stats_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_qr_codes" ADD CONSTRAINT "channel_qr_codes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_qr_codes" ADD CONSTRAINT "channel_qr_codes_authorizerId_fkey" FOREIGN KEY ("authorizerId") REFERENCES "authorizers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_qr_codes" ADD CONSTRAINT "channel_qr_codes_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_code_scans" ADD CONSTRAINT "qr_code_scans_qrCodeId_fkey" FOREIGN KEY ("qrCodeId") REFERENCES "channel_qr_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversion_funnels" ADD CONSTRAINT "conversion_funnels_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversion_funnels" ADD CONSTRAINT "conversion_funnels_authorizerId_fkey" FOREIGN KEY ("authorizerId") REFERENCES "authorizers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfm_segments" ADD CONSTRAINT "rfm_segments_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "followers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follower_events" ADD CONSTRAINT "follower_events_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "followers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_configs" ADD CONSTRAINT "llm_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_usage_logs" ADD CONSTRAINT "llm_usage_logs_configId_fkey" FOREIGN KEY ("configId") REFERENCES "llm_configs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skills" ADD CONSTRAINT "skills_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_skills" ADD CONSTRAINT "agent_skills_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_skills" ADD CONSTRAINT "agent_skills_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_authorizers" ADD CONSTRAINT "user_authorizers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_authorizers" ADD CONSTRAINT "user_authorizers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_authorizers" ADD CONSTRAINT "user_authorizers_authorizerId_fkey" FOREIGN KEY ("authorizerId") REFERENCES "authorizers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_records" ADD CONSTRAINT "subscription_records_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_configs" ADD CONSTRAINT "payment_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
