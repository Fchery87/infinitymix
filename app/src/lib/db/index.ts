import { neon, neonConfig } from '@neondatabase/serverless';
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

neonConfig.fetchConnectionCache = true;

// Primary connection for application queries (optimized for Neon serverless)
const sql = neon<boolean, boolean>(connectionString);
export const db = drizzleNeon(sql, { schema });

// Secondary connection for migrations and tooling
const migrationClient = postgres(connectionString, { max: 1, prepare: false, ssl: 'require' });
export const migrationDb = drizzlePostgres(migrationClient, { schema });

export { schema };
