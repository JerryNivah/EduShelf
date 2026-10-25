-- 1. Reject inconsistent ownership before backfilling
-- Convert existing family identifiers from TEXT to UUID
-- before validating ownership or adding the foreign key.

ALTER TABLE "public"."RefreshSessionFamily"
ALTER COLUMN "id" TYPE UUID
USING "id"::UUID;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "public"."RefreshSession"
    GROUP BY "familyId"
    HAVING COUNT(DISTINCT "userId") > 1
  ) THEN
    RAISE EXCEPTION 'Conflicting refresh-session family ownership';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "public"."RefreshSession" s
    JOIN "public"."RefreshSessionFamily" f
      ON f."id" = s."familyId"
    WHERE f."userId" <> s."userId"
  ) THEN
    RAISE EXCEPTION 'Refresh-session family owner mismatch';
  END IF;
END $$;

-- 2. Backfill missing families using existing identifiers

INSERT INTO "public"."RefreshSessionFamily"
  ("id", "userId", "revokedAt", "createdAt")
SELECT
  "familyId",
  MIN("userId"),
  MAX("revokedAt"),
  CURRENT_TIMESTAMP
FROM "public"."RefreshSession"
GROUP BY "familyId"
ON CONFLICT ("id") DO NOTHING;

-- 3. Preserve revocation if a parent already exists

UPDATE "public"."RefreshSessionFamily" f
SET "revokedAt" = s."revokedAt"
FROM (
  SELECT
    "familyId",
    MAX("revokedAt") AS "revokedAt"
  FROM "public"."RefreshSession"
  WHERE "revokedAt" IS NOT NULL
  GROUP BY "familyId"
) s
WHERE f."id" = s."familyId"
  AND f."revokedAt" IS NULL;

-- 4. Enforce the foreign-key relationship

ALTER TABLE "public"."RefreshSession"
ADD CONSTRAINT "RefreshSession_familyId_fkey"
FOREIGN KEY ("familyId")
REFERENCES "public"."RefreshSessionFamily"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
