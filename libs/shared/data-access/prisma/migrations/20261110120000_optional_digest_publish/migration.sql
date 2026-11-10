-- AlterTable
ALTER TABLE "standup_configs" ADD COLUMN "publish_github" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "standup_configs" ADD COLUMN "publish_jira" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "standup_configs" ADD COLUMN "publish_linear" BOOLEAN NOT NULL DEFAULT false;
