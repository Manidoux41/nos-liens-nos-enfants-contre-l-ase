CREATE TYPE "PollStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');

CREATE TABLE "Poll" (
  "id" UUID NOT NULL,
  "title" VARCHAR(180) NOT NULL,
  "slug" VARCHAR(120) NOT NULL,
  "description" VARCHAR(2000) NOT NULL,
  "status" "PollStatus" NOT NULL DEFAULT 'DRAFT',
  "resultsPublished" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Poll_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Poll_slug_key" ON "Poll"("slug");

INSERT INTO "Poll" ("id", "title", "slug", "description", "status", "resultsPublished", "updatedAt")
VALUES ('00000000-0000-4000-8000-000000000001', 'Les parcours des familles', 'parcours-des-familles',
  'Départements, premier placement et retour au foyer : faites entendre votre parcours.',
  'PUBLISHED', true, CURRENT_TIMESTAMP);

ALTER TABLE "SurveyResponse"
  ADD COLUMN "pollId" UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001',
  ADD COLUMN "emailHash" VARCHAR(64);
CREATE UNIQUE INDEX "SurveyResponse_pollId_emailHash_key" ON "SurveyResponse"("pollId", "emailHash");
CREATE INDEX "SurveyResponse_pollId_status_expiresAt_idx" ON "SurveyResponse"("pollId", "status", "expiresAt");
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_pollId_fkey"
  FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "SurveyEmailChallenge" (
  "id" UUID NOT NULL,
  "pollId" UUID NOT NULL,
  "emailHash" VARCHAR(64) NOT NULL,
  "codeHash" VARCHAR(64) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SurveyEmailChallenge_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SurveyEmailChallenge_pollId_emailHash_key" ON "SurveyEmailChallenge"("pollId", "emailHash");
CREATE INDEX "SurveyEmailChallenge_expiresAt_idx" ON "SurveyEmailChallenge"("expiresAt");
ALTER TABLE "SurveyEmailChallenge" ADD CONSTRAINT "SurveyEmailChallenge_pollId_fkey"
  FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;
