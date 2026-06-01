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
