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

-- AddForeignKey
ALTER TABLE "conversion_funnels" ADD CONSTRAINT "conversion_funnels_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversion_funnels" ADD CONSTRAINT "conversion_funnels_authorizerId_fkey" FOREIGN KEY ("authorizerId") REFERENCES "authorizers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfm_segments" ADD CONSTRAINT "rfm_segments_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "followers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follower_events" ADD CONSTRAINT "follower_events_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "followers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
