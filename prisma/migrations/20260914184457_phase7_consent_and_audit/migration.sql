-- CreateEnum
CREATE TYPE "ConsentPurpose" AS ENUM ('RESEARCH_IMPROVEMENT');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('RESEARCH_CONSENT_GRANTED', 'RESEARCH_CONSENT_WITHDRAWN', 'RESEARCH_EXPORT_GENERATED', 'CAREGIVER_SNAPSHOT_ISSUED', 'ACCOUNT_DATA_EXPORTED', 'ACCOUNT_DATA_DELETED', 'CAREGIVER_LINK_CHANGED');

-- CreateTable
CREATE TABLE "ResearchConsent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "purpose" "ConsentPurpose" NOT NULL DEFAULT 'RESEARCH_IMPROVEMENT',
    "consented" BOOLEAN NOT NULL,
    "consentedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "userId" TEXT,
    "caregiverId" TEXT,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResearchConsent_userId_idx" ON "ResearchConsent"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchConsent_userId_version_key" ON "ResearchConsent"("userId", "version");

-- CreateIndex
CREATE INDEX "AuditEvent_userId_createdAt_idx" ON "AuditEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_action_createdAt_idx" ON "AuditEvent"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "ResearchConsent" ADD CONSTRAINT "ResearchConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
