-- AlterTable
ALTER TABLE "User" ADD COLUMN     "monthlyAuditCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "monthlyAuditResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "seoTier" TEXT NOT NULL DEFAULT 'free';

-- CreateTable
CREATE TABLE "SiteAudit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "entryUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tier" TEXT NOT NULL,
    "renderVerdict" TEXT NOT NULL,
    "pagesCrawled" INTEGER NOT NULL,
    "pagesSkipped" INTEGER NOT NULL DEFAULT 0,
    "blockingCount" INTEGER NOT NULL DEFAULT 0,
    "warnCount" INTEGER NOT NULL DEFAULT 0,
    "medianBotWords" INTEGER NOT NULL DEFAULT 0,
    "orphanCount" INTEGER NOT NULL DEFAULT 0,
    "maxDepth" INTEGER NOT NULL DEFAULT 0,
    "stack" TEXT,
    "report" JSONB NOT NULL,

    CONSTRAINT "SiteAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SiteAudit_userId_createdAt_idx" ON "SiteAudit"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SiteAudit_host_createdAt_idx" ON "SiteAudit"("host", "createdAt");

-- CreateIndex
CREATE INDEX "SiteAudit_stack_idx" ON "SiteAudit"("stack");

-- AddForeignKey
ALTER TABLE "SiteAudit" ADD CONSTRAINT "SiteAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

