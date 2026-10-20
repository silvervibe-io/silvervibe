-- AlterTable
ALTER TABLE "standup_configs" ADD COLUMN "reminder_hour" INTEGER NOT NULL DEFAULT 9;
ALTER TABLE "standup_configs" ADD COLUMN "reminder_minute" INTEGER NOT NULL DEFAULT 0;
