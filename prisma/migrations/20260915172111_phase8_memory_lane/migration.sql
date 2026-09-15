-- CreateEnum
CREATE TYPE "MemoryPresentationMode" AS ENUM ('PERSON_RECOGNITION', 'NAME_RECALL', 'RELATIONSHIP_RECALL', 'PLACE_RECOGNITION', 'CONTEXT_RECALL');

-- AlterEnum
ALTER TYPE "MemoryRecallOutcome" ADD VALUE 'ASSISTED';

-- AlterTable
ALTER TABLE "MemoryRecallEvent" ADD COLUMN     "intervalStep" INTEGER,
ADD COLUMN     "presentation" "MemoryPresentationMode";

-- CreateTable
CREATE TABLE "MemoryAudio" (
    "id" TEXT NOT NULL,
    "memoryId" TEXT NOT NULL,
    "caregiverId" TEXT,
    "path" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemoryAudio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MemoryAudio_memoryId_key" ON "MemoryAudio"("memoryId");

-- CreateIndex
CREATE INDEX "MemoryAudio_caregiverId_idx" ON "MemoryAudio"("caregiverId");

-- AddForeignKey
ALTER TABLE "MemoryAudio" ADD CONSTRAINT "MemoryAudio_memoryId_fkey" FOREIGN KEY ("memoryId") REFERENCES "PersonalMemory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryAudio" ADD CONSTRAINT "MemoryAudio_caregiverId_fkey" FOREIGN KEY ("caregiverId") REFERENCES "Caregiver"("id") ON DELETE SET NULL ON UPDATE CASCADE;
