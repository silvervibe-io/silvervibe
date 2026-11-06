-- CreateTable
CREATE TABLE "standup_aways" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "entry_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "standup_aways_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "standup_aways_team_id_entry_date_idx" ON "standup_aways"("team_id", "entry_date");

-- CreateIndex
CREATE UNIQUE INDEX "standup_aways_team_id_user_id_entry_date_key" ON "standup_aways"("team_id", "user_id", "entry_date");

-- AddForeignKey
ALTER TABLE "standup_aways" ADD CONSTRAINT "standup_aways_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "standup_aways" ADD CONSTRAINT "standup_aways_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
