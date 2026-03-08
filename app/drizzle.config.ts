import fs from 'node:fs';
import path from 'node:path';

function loadLocalEnvFile(filename: string) {
  const filePath = path.resolve(process.cwd(), filename);
  if (!fs.existsSync(filePath)) return;

  const fileContents = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of fileContents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) continue;

    const key = line.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) continue;

    const value = line
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^"(.*)"$/, '$1')
      .replace(/^'(.*)'$/, '$1');

    process.env[key] = value;
  }
}

loadLocalEnvFile('.env.local');
loadLocalEnvFile('.env');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set in the environment');
}

const config = {
  schema: './src/lib/db/schema.ts',
  out: './.drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  verbose: true,
  strict: true,
};

export default config;
