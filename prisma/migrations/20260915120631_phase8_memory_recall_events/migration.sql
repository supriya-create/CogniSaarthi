-- CreateEnum
CREATE TYPE "MemoryRecallOutcome" AS ENUM ('RECOGNISED', 'NOT_RECOGNISED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "MemoryRecallMode" AS ENUM ('CHOICE', 'VOICE');

-- CreateTable
CREATE TABLE "MemoryRecallEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memoryId" TEXT NOT NULL,
    "clientEventId" TEXT NOT NULL,
    "outcome" "MemoryRecallOutcome" NOT NULL,
    "mode" "MemoryRecallMode" NOT NULL,
    "responseTimeMs" INTEGER,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoryRecallEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MemoryRecallEvent_clientEventId_key" ON "MemoryRecallEvent"("clientEventId");

-- CreateIndex
CREATE INDEX "MemoryRecallEvent_userId_occurredAt_idx" ON "MemoryRecallEvent"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "MemoryRecallEvent_memoryId_occurredAt_idx" ON "MemoryRecallEvent"("memoryId", "occurredAt");

-- AddForeignKey
ALTER TABLE "MemoryRecallEvent" ADD CONSTRAINT "MemoryRecallEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryRecallEvent" ADD CONSTRAINT "MemoryRecallEvent_memoryId_fkey" FOREIGN KEY ("memoryId") REFERENCES "PersonalMemory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
