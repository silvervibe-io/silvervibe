-- AlterTable
ALTER TABLE "standup_entries" ADD COLUMN "submitted_via" TEXT;

-- CreateTable
CREATE TABLE "slack_user_links" (
    "id" TEXT NOT NULL,
    "slack_team_id" TEXT NOT NULL,
    "slack_user_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slack_user_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "slack_user_links_email_idx" ON "slack_user_links"("email");

-- CreateIndex
CREATE UNIQUE INDEX "slack_user_links_slack_team_id_slack_user_id_key" ON "slack_user_links"("slack_team_id", "slack_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "slack_user_links_user_id_slack_team_id_key" ON "slack_user_links"("user_id", "slack_team_id");

-- AddForeignKey
ALTER TABLE "slack_user_links" ADD CONSTRAINT "slack_user_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
