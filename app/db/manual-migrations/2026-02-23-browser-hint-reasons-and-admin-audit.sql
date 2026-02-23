-- Persist exact browser-hint decision reasons and admin action audit trails.
ALTER TABLE "uploaded_tracks"
ADD COLUMN IF NOT EXISTS "browser_hint_decision_reason" varchar(64);

CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "admin_user_id" text,
  "admin_user_email" varchar(255),
  "action" varchar(64) NOT NULL,
  "resource_type" varchar(64) NOT NULL,
  "resource_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_admin_audit_logs_action"
ON "admin_audit_logs" USING btree ("action");

CREATE INDEX IF NOT EXISTS "idx_admin_audit_logs_created_at"
ON "admin_audit_logs" USING btree ("created_at");
