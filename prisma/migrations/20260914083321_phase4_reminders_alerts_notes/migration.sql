-- CreateEnum
CREATE TYPE "ReminderCategory" AS ENUM ('MEDICATION', 'APPOINTMENT', 'DAILY_ROUTINE', 'COGNITIVE_ACTIVITY', 'FAMILY', 'OTHER');

-- CreateEnum
CREATE TYPE "RecurrenceType" AS ENUM ('ONCE', 'DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "ReminderPriority" AS ENUM ('NORMAL', 'IMPORTANT');

-- CreateEnum
CREATE TYPE "ReminderLogStatus" AS ENUM ('PENDING', 'DONE', 'SKIPPED', 'SNOOZED', 'MISSED');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'ATTENTION', 'IMPORTANT');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('REMINDER_MISSED', 'INACTIVITY', 'PERFORMANCE_CHANGE', 'ACTIVITY_DIFFICULTY', 'REMINDER_UPCOMING', 'DAILY_COMPLETE');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('UNREAD', 'READ', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "NoteCategory" AS ENUM ('GENERAL', 'MOOD', 'ACTIVITY', 'SLEEP', 'APPETITE', 'OTHER');

-- AlterTable
ALTER TABLE "UserPreference" ADD COLUMN     "autoReadReminders" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notificationSound" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "reminderVoice" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "timeZone" TEXT NOT NULL DEFAULT 'Asia/Kolkata';

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "caregiverId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "ReminderCategory" NOT NULL DEFAULT 'OTHER',
    "priority" "ReminderPriority" NOT NULL DEFAULT 'NORMAL',
    "timeMinutes" INTEGER NOT NULL,
    "recurrence" "RecurrenceType" NOT NULL DEFAULT 'ONCE',
    "weekdays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "monthDay" INTEGER,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderLog" (
    "id" TEXT NOT NULL,
    "reminderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" "ReminderLogStatus" NOT NULL DEFAULT 'PENDING',
    "acknowledgedAt" TIMESTAMP(3),
    "snoozedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaregiverNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "caregiverId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "body" TEXT NOT NULL,
    "category" "NoteCategory" NOT NULL DEFAULT 'GENERAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaregiverNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'UNREAD',
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedByCaregiverId" TEXT,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyContact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "relationship" TEXT NOT NULL DEFAULT 'Family member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaregiverPreference" (
    "id" TEXT NOT NULL,
    "caregiverId" TEXT NOT NULL,
    "reminderNotifications" BOOLEAN NOT NULL DEFAULT true,
    "cognitiveActivityReminders" BOOLEAN NOT NULL DEFAULT true,
    "alertNotifications" BOOLEAN NOT NULL DEFAULT true,
    "weeklySummary" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaregiverPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reminder_userId_enabled_idx" ON "Reminder"("userId", "enabled");

-- CreateIndex
CREATE INDEX "Reminder_caregiverId_idx" ON "Reminder"("caregiverId");

-- CreateIndex
CREATE INDEX "ReminderLog_userId_scheduledFor_idx" ON "ReminderLog"("userId", "scheduledFor");

-- CreateIndex
CREATE INDEX "ReminderLog_userId_status_idx" ON "ReminderLog"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderLog_reminderId_scheduledFor_key" ON "ReminderLog"("reminderId", "scheduledFor");

-- CreateIndex
CREATE INDEX "CaregiverNote_userId_date_idx" ON "CaregiverNote"("userId", "date");

-- CreateIndex
CREATE INDEX "CaregiverNote_caregiverId_idx" ON "CaregiverNote"("caregiverId");

-- CreateIndex
CREATE INDEX "Alert_userId_status_idx" ON "Alert"("userId", "status");

-- CreateIndex
CREATE INDEX "Alert_userId_createdAt_idx" ON "Alert"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Alert_userId_dedupeKey_key" ON "Alert"("userId", "dedupeKey");

-- CreateIndex
CREATE INDEX "EmergencyContact_userId_idx" ON "EmergencyContact"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CaregiverPreference_caregiverId_key" ON "CaregiverPreference"("caregiverId");

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_caregiverId_fkey" FOREIGN KEY ("caregiverId") REFERENCES "Caregiver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderLog" ADD CONSTRAINT "ReminderLog_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "Reminder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderLog" ADD CONSTRAINT "ReminderLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaregiverNote" ADD CONSTRAINT "CaregiverNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaregiverNote" ADD CONSTRAINT "CaregiverNote_caregiverId_fkey" FOREIGN KEY ("caregiverId") REFERENCES "Caregiver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyContact" ADD CONSTRAINT "EmergencyContact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaregiverPreference" ADD CONSTRAINT "CaregiverPreference_caregiverId_fkey" FOREIGN KEY ("caregiverId") REFERENCES "Caregiver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
