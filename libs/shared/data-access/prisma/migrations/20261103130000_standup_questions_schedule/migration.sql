-- CreateEnum
CREATE TYPE "StandupScheduleKind" AS ENUM ('DEADLINE', 'WINDOW');

-- CreateEnum
CREATE TYPE "StandupReveal" AS ENUM ('LIVE', 'TOGETHER');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC';

-- AlterTable
ALTER TABLE "users" ADD COLUMN "work_hours_json" JSONB NOT NULL DEFAULT '{"mon":{"enabled":true,"start":"09:00","end":"17:00"},"tue":{"enabled":true,"start":"09:00","end":"17:00"},"wed":{"enabled":true,"start":"09:00","end":"17:00"},"thu":{"enabled":true,"start":"09:00","end":"17:00"},"fri":{"enabled":true,"start":"09:00","end":"17:00"},"sat":{"enabled":false,"start":"09:00","end":"17:00"},"sun":{"enabled":false,"start":"09:00","end":"17:00"}}';

-- AlterTable
ALTER TABLE "standup_configs" ADD COLUMN "schedule_kind" "StandupScheduleKind" NOT NULL DEFAULT 'DEADLINE';

-- AlterTable
ALTER TABLE "standup_configs" ADD COLUMN "window_start_hour" INTEGER NOT NULL DEFAULT 8;

-- AlterTable
ALTER TABLE "standup_configs" ADD COLUMN "window_start_minute" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "standup_configs" ADD COLUMN "reveal" "StandupReveal" NOT NULL DEFAULT 'LIVE';

-- AlterTable
ALTER TABLE "standup_entries" ADD COLUMN "answers_json" JSONB NOT NULL DEFAULT '{}';
