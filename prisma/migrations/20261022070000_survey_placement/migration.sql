CREATE TYPE "ReturnHomeStatus" AS ENUM ('ALL', 'SOME', 'NONE', 'NOT_APPLICABLE', 'UNDISCLOSED');

ALTER TABLE "SurveyResponse"
ADD COLUMN "placementYear" INTEGER,
ADD COLUMN "returnHome" "ReturnHomeStatus";

ALTER TABLE "SurveyResponse"
ADD CONSTRAINT "SurveyResponse_placementYear_check"
CHECK ("placementYear" IS NULL OR "placementYear" BETWEEN 1900 AND 9999),
ADD CONSTRAINT "SurveyResponse_placement_consistency_check"
CHECK ("returnHome" IS DISTINCT FROM 'NOT_APPLICABLE' OR "placementYear" IS NULL);
