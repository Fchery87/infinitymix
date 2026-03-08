DO $$ BEGIN
 CREATE TYPE automation_job_kind AS ENUM ('analysis', 'stems', 'mix');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE automation_job_status AS ENUM ('queued', 'running', 'succeeded', 'failed', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS automation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind automation_job_kind NOT NULL,
  status automation_job_status NOT NULL DEFAULT 'queued',
  resource_kind varchar(32) NOT NULL,
  resource_id text NOT NULL,
  payload jsonb NOT NULL,
  owner_runtime varchar(32) NOT NULL DEFAULT 'app',
  owner_legacy_mode varchar(64) NOT NULL DEFAULT 'legacy-non-authoritative',
  driver varchar(32) NOT NULL DEFAULT 'durable',
  retryable boolean NOT NULL DEFAULT true,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  idempotency_key varchar(255) NOT NULL,
  last_error text,
  available_at timestamp NOT NULL DEFAULT now(),
  locked_at timestamp,
  locked_by varchar(128),
  lock_token varchar(128),
  started_at timestamp,
  completed_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_jobs_status_available
  ON automation_jobs (status, available_at);

CREATE INDEX IF NOT EXISTS idx_automation_jobs_resource
  ON automation_jobs (resource_kind, resource_id);

CREATE INDEX IF NOT EXISTS idx_automation_jobs_idempotency
  ON automation_jobs (idempotency_key);

CREATE INDEX IF NOT EXISTS idx_automation_jobs_lock_token
  ON automation_jobs (lock_token);

CREATE INDEX IF NOT EXISTS idx_automation_jobs_created_at
  ON automation_jobs (created_at);
