import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

neonConfig.fetchConnectionCache = true;

// Primary connection for application queries (optimized for Neon serverless)
const sql = neon(connectionString);
export const db = drizzleNeon(sql, { schema });

// Secondary connection for migrations and tooling
const migrationClient = postgres(connectionString, { max: 1, prepare: false, ssl: 'require' });
export const migrationDb = drizzlePostgres(migrationClient, { schema });

export { schema };
