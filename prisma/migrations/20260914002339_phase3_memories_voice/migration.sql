-- CreateEnum
CREATE TYPE "SpeechRate" AS ENUM ('SLOW', 'NORMAL');

-- CreateEnum
CREATE TYPE "MemoryCategory" AS ENUM ('PERSON', 'PLACE', 'THING', 'MOMENT');

-- AlterTable
ALTER TABLE "UserPreference" ADD COLUMN     "autoReadInstructions" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "speechRate" "SpeechRate" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "voiceEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PersonalMemory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "caregiverId" TEXT NOT NULL,
    "category" "MemoryCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "relationship" TEXT,
    "description" TEXT,
    "imagePath" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalMemory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonalMemory_userId_enabled_idx" ON "PersonalMemory"("userId", "enabled");

-- CreateIndex
CREATE INDEX "PersonalMemory_caregiverId_idx" ON "PersonalMemory"("caregiverId");

-- AddForeignKey
ALTER TABLE "PersonalMemory" ADD CONSTRAINT "PersonalMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalMemory" ADD CONSTRAINT "PersonalMemory_caregiverId_fkey" FOREIGN KEY ("caregiverId") REFERENCES "Caregiver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

