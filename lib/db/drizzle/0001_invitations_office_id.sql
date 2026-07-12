-- PR-AUTH-001: scope invitations to tenant office
ALTER TABLE "invitations" ADD COLUMN IF NOT EXISTS "office_id" text;

CREATE INDEX IF NOT EXISTS "idx_invitations_office_id" ON "invitations" ("office_id");
