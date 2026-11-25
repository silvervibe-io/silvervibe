-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "MeetingEditPolicy" AS ENUM ('CREATOR_OR_ADMIN', 'CREATOR_ONLY', 'ANY_INVITEE');

-- CreateEnum
CREATE TYPE "MeetingClosePolicy" AS ENUM ('CREATOR_OR_ADMIN', 'CREATOR_ONLY', 'ANY_INVITEE');

-- CreateTable
CREATE TABLE "meetings" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "context" TEXT,
    "status" "MeetingStatus" NOT NULL DEFAULT 'OPEN',
    "edit_policy" "MeetingEditPolicy" NOT NULL DEFAULT 'CREATOR_OR_ADMIN',
    "close_policy" "MeetingClosePolicy" NOT NULL DEFAULT 'CREATOR_OR_ADMIN',
    "scheduled_at" TIMESTAMP(3),
    "recap" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_agenda_items" (
    "id" TEXT NOT NULL,
    "meeting_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_agenda_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_invites" (
    "id" TEXT NOT NULL,
    "meeting_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_decisions" (
    "id" TEXT NOT NULL,
    "meeting_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_actions" (
    "id" TEXT NOT NULL,
    "meeting_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "assignee_id" TEXT,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meetings_workspace_id_status_idx" ON "meetings"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "meeting_agenda_items_meeting_id_idx" ON "meeting_agenda_items"("meeting_id");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_invites_meeting_id_user_id_key" ON "meeting_invites"("meeting_id", "user_id");

-- CreateIndex
CREATE INDEX "meeting_decisions_meeting_id_idx" ON "meeting_decisions"("meeting_id");

-- CreateIndex
CREATE INDEX "meeting_actions_meeting_id_idx" ON "meeting_actions"("meeting_id");

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_agenda_items" ADD CONSTRAINT "meeting_agenda_items_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_invites" ADD CONSTRAINT "meeting_invites_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_invites" ADD CONSTRAINT "meeting_invites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_decisions" ADD CONSTRAINT "meeting_decisions_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_actions" ADD CONSTRAINT "meeting_actions_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
