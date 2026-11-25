-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "FeedbackAnswerVisibility" AS ENUM ('PRIVATE_TO_REQUESTER', 'SHARED_WITH_INVITEES');

-- CreateEnum
CREATE TYPE "FeedbackClosePolicy" AS ENUM ('CREATOR_OR_ADMIN', 'CREATOR_ONLY', 'ANY_INVITEE');

-- CreateTable
CREATE TABLE "feedback_requests" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "context" TEXT,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'OPEN',
    "answer_visibility" "FeedbackAnswerVisibility" NOT NULL DEFAULT 'PRIVATE_TO_REQUESTER',
    "anonymous" BOOLEAN NOT NULL DEFAULT false,
    "close_policy" "FeedbackClosePolicy" NOT NULL DEFAULT 'CREATOR_OR_ADMIN',
    "ends_at" TIMESTAMP(3),
    "summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_prompts" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_invites" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_answers" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "prompt_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feedback_requests_workspace_id_status_idx" ON "feedback_requests"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "feedback_prompts_request_id_idx" ON "feedback_prompts"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_invites_request_id_user_id_key" ON "feedback_invites"("request_id", "user_id");

-- CreateIndex
CREATE INDEX "feedback_answers_request_id_author_id_idx" ON "feedback_answers"("request_id", "author_id");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_answers_prompt_id_author_id_key" ON "feedback_answers"("prompt_id", "author_id");

-- AddForeignKey
ALTER TABLE "feedback_requests" ADD CONSTRAINT "feedback_requests_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_requests" ADD CONSTRAINT "feedback_requests_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_prompts" ADD CONSTRAINT "feedback_prompts_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "feedback_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_invites" ADD CONSTRAINT "feedback_invites_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "feedback_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_invites" ADD CONSTRAINT "feedback_invites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_answers" ADD CONSTRAINT "feedback_answers_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "feedback_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_answers" ADD CONSTRAINT "feedback_answers_prompt_id_fkey" FOREIGN KEY ("prompt_id") REFERENCES "feedback_prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_answers" ADD CONSTRAINT "feedback_answers_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
