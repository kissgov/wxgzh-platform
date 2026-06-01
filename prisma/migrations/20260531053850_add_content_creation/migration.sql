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
