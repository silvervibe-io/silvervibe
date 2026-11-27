-- CreateEnum
CREATE TYPE "RetroStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "RetroNoteVisibility" AS ENUM ('LIVE', 'PRIVATE_UNTIL_CLOSE', 'AFTER_CONTRIBUTE');

-- CreateEnum
CREATE TYPE "RetroClosePolicy" AS ENUM ('CREATOR_OR_ADMIN', 'CREATOR_ONLY', 'ANY_INVITEE');

-- CreateEnum
CREATE TYPE "RetroNoteColumn" AS ENUM ('WENT_WELL', 'IMPROVE', 'ACTIONS');

-- CreateTable
CREATE TABLE "retros" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "RetroStatus" NOT NULL DEFAULT 'OPEN',
    "note_visibility" "RetroNoteVisibility" NOT NULL DEFAULT 'LIVE',
    "close_policy" "RetroClosePolicy" NOT NULL DEFAULT 'CREATOR_OR_ADMIN',
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retro_invites" (
    "id" TEXT NOT NULL,
    "retro_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retro_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retro_notes" (
    "id" TEXT NOT NULL,
    "retro_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "column" "RetroNoteColumn" NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retro_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "retros_workspace_id_status_idx" ON "retros"("workspace_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "retro_invites_retro_id_user_id_key" ON "retro_invites"("retro_id", "user_id");

-- CreateIndex
CREATE INDEX "retro_notes_retro_id_column_idx" ON "retro_notes"("retro_id", "column");

-- CreateIndex
CREATE INDEX "retro_notes_retro_id_author_id_idx" ON "retro_notes"("retro_id", "author_id");

-- AddForeignKey
ALTER TABLE "retros" ADD CONSTRAINT "retros_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retros" ADD CONSTRAINT "retros_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retro_invites" ADD CONSTRAINT "retro_invites_retro_id_fkey" FOREIGN KEY ("retro_id") REFERENCES "retros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retro_invites" ADD CONSTRAINT "retro_invites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retro_notes" ADD CONSTRAINT "retro_notes_retro_id_fkey" FOREIGN KEY ("retro_id") REFERENCES "retros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retro_notes" ADD CONSTRAINT "retro_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
