import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function fixSchema() {
  console.log('Creating tables with TEXT id types...');
  
  // Create enums if they don't exist
  await sql`DO $$ BEGIN CREATE TYPE upload_status AS ENUM ('pending', 'uploaded', 'failed'); EXCEPTION WHEN duplicate_object THEN null; END $$`;
  await sql`DO $$ BEGIN CREATE TYPE analysis_status AS ENUM ('pending', 'analyzing', 'completed', 'failed'); EXCEPTION WHEN duplicate_object THEN null; END $$`;
  await sql`DO $$ BEGIN CREATE TYPE generation_status AS ENUM ('pending', 'generating', 'completed', 'failed'); EXCEPTION WHEN duplicate_object THEN null; END $$`;
  
  // Create users table
  await sql`CREATE TABLE IF NOT EXISTS users (
    id text PRIMARY KEY,
    email varchar(255) NOT NULL UNIQUE,
    name varchar(150) NOT NULL,
    password_hash varchar(255),
    username varchar(100),
    email_verified boolean NOT NULL DEFAULT false,
    image varchar(512),
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )`;
  
  // Create accounts table
  await sql`CREATE TABLE IF NOT EXISTS accounts (
    id text PRIMARY KEY,
    account_id varchar(255) NOT NULL,
    provider_id varchar(255) NOT NULL,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_token text,
    refresh_token text,
    id_token text,
    access_token_expires_at timestamp,
    refresh_token_expires_at timestamp,
    scope text,
    password varchar(255),
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )`;
  
  // Create sessions table
  await sql`CREATE TABLE IF NOT EXISTS sessions (
    id text PRIMARY KEY,
    expires_at timestamp NOT NULL,
    token varchar(255) NOT NULL UNIQUE,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now(),
    ip_address varchar(255),
    user_agent text,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE
  )`;
  
  // Create verifications table
  await sql`CREATE TABLE IF NOT EXISTS verifications (
    id text PRIMARY KEY,
    identifier varchar(255) NOT NULL,
    value text NOT NULL,
    expires_at timestamp NOT NULL,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )`;
  
  // Create uploaded_tracks table
  await sql`CREATE TABLE IF NOT EXISTS uploaded_tracks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    original_filename varchar(255) NOT NULL,
    storage_url varchar(512) NOT NULL,
    file_size_bytes integer NOT NULL,
    mime_type varchar(50) NOT NULL,
    upload_status upload_status NOT NULL DEFAULT 'pending',
    analysis_status analysis_status NOT NULL DEFAULT 'pending',
    bpm numeric(5, 2),
    key_signature varchar(20),
    duration_seconds numeric(7, 2),
    has_stems boolean NOT NULL DEFAULT false,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )`;
  
  // Create mashups table
  await sql`CREATE TABLE IF NOT EXISTS mashups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name varchar(255) NOT NULL,
    target_duration_seconds integer NOT NULL,
    output_storage_url varchar(512),
    generation_status generation_status NOT NULL DEFAULT 'pending',
    playback_count integer NOT NULL DEFAULT 0,
    download_count integer NOT NULL DEFAULT 0,
    output_format varchar(10) NOT NULL DEFAULT 'mp3',
    generation_time_ms integer,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )`;
  
  // Create mashup_input_tracks table
  await sql`CREATE TABLE IF NOT EXISTS mashup_input_tracks (
    mashup_id uuid NOT NULL REFERENCES mashups(id) ON DELETE CASCADE,
    uploaded_track_id uuid NOT NULL REFERENCES uploaded_tracks(id) ON DELETE CASCADE,
    created_at timestamp NOT NULL DEFAULT now()
  )`;
  
  // Create feedback table
  await sql`CREATE TABLE IF NOT EXISTS feedback (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mashup_id uuid NOT NULL REFERENCES mashups(id) ON DELETE CASCADE,
    rating integer NOT NULL,
    comments text,
    created_at timestamp NOT NULL DEFAULT now()
  )`;
  
  // Create indexes
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS accounts_provider_account_unique ON accounts (provider_id, account_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts (user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_verifications_identifier ON verifications (identifier)`;
  
  console.log('All tables created successfully!');
}

fixSchema().catch(console.error);
