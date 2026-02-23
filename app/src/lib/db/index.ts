import { neon } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

function isValidDatabaseUrl(value?: string) {
  if (!value) return false;
  try {
    const url = new URL(value.replace(/^psql\s+['"]?/, '').replace(/['"]?$/, ''));
    return ['postgres:', 'postgresql:'].includes(url.protocol);
  } catch {
    return false;
  }
}

const connectionString = isValidDatabaseUrl(process.env.DATABASE_URL)
  ? process.env.DATABASE_URL!.replace(/^psql\s+['"]?/, '').replace(/['"]?$/, '')
  : 'postgres://placeholder:placeholder@localhost:5432/placeholder';

if (!isValidDatabaseUrl(process.env.DATABASE_URL)) {
  const message = 'DATABASE_URL is missing or invalid; provide a valid Neon/Postgres connection string.';
  if (process.env.NODE_ENV === 'production') {
    throw new Error(message);
  } else {
    console.warn(`${message} Using placeholder for local build-time only.`);
  }
}

// Primary connection for application queries (optimized for Neon serverless)
const sql = neon<boolean, boolean>(connectionString);
export const db = drizzleNeon(sql, { schema });

// Secondary connection for migrations and tooling
const migrationClient = postgres(connectionString, { max: 1, prepare: false, ssl: 'require' });
export const migrationDb = drizzlePostgres(migrationClient, { schema });

export { schema };

// Helper functions for common track operations
import { eq } from 'drizzle-orm';
import { uploadedTracks } from './schema';

export async function getTrack(trackId: string) {
  const [track] = await db
    .select()
    .from(uploadedTracks)
    .where(eq(uploadedTracks.id, trackId))
    .limit(1);
  return track ?? null;
}

export async function updateTrack(trackId: string, data: Partial<typeof uploadedTracks.$inferInsert>) {
  const [updated] = await db
    .update(uploadedTracks)
    .set(data)
    .where(eq(uploadedTracks.id, trackId))
    .returning();
  return updated ?? null;
}
