#!/usr/bin/env node

/**
 * Infrastructure Verification Script
 * Tests all core infrastructure components
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

console.log('🔍 InfinityMix Infrastructure Verification\n');

const results = {
  database: { status: 'pending', message: '' },
  storage: { status: 'pending', message: '' },
  auth: { status: 'pending', message: '' },
  migrations: { status: 'pending', message: '' },
};

// Test 1: Database Connection
console.log('📊 Testing Database Connection...');
try {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not set');
  }

  const url = new URL(process.env.DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('Invalid DATABASE_URL protocol');
  }

  const { default: postgres } = await import('postgres');
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  
  const [result] = await sql`SELECT 1 as test, current_database() as db, version() as version`;
  await sql.end();

  results.database.status = 'pass';
  results.database.message = `Connected to ${result.db}`;
  console.log(`   ✅ Database: ${result.db}`);
  console.log(`   ℹ️  ${result.version.split(',')[0]}\n`);
} catch (error) {
  results.database.status = 'fail';
  results.database.message = error.message;
  console.log(`   ❌ Database Error: ${error.message}\n`);
}

// Test 2: Database Schema
console.log('🗄️  Testing Database Schema...');
try {
  const { default: postgres } = await import('postgres');
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `;
  
  const expectedTables = [
    'users', 'accounts', 'sessions', 'verifications',
    'uploaded_tracks', 'track_stems', 'mashups', 'mashup_input_tracks',
    'feedback', 'plans', 'user_plans', 'challenges', 'challenge_submissions',
    'collab_invites', 'recommendations', 'playback_surveys'
  ];
  
  const tableNames = tables.map(t => t.table_name);
  const missing = expectedTables.filter(t => !tableNames.includes(t));
  
  await sql.end();

  if (missing.length > 0) {
    results.migrations.status = 'warn';
    results.migrations.message = `Missing tables: ${missing.join(', ')}`;
    console.log(`   ⚠️  Missing tables: ${missing.join(', ')}\n`);
  } else {
    results.migrations.status = 'pass';
    results.migrations.message = `All ${expectedTables.length} tables present`;
    console.log(`   ✅ All ${expectedTables.length} tables present`);
    console.log(`   ℹ️  Schema is complete\n`);
  }
} catch (error) {
  results.migrations.status = 'fail';
  results.migrations.message = error.message;
  console.log(`   ❌ Schema Error: ${error.message}\n`);
}

// Test 3: User Table Structure (Better Auth compatibility)
console.log('👤 Testing User Table Structure...');
try {
  const { default: postgres } = await import('postgres');
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  
  const columns = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'users' AND table_schema = 'public'
    ORDER BY ordinal_position
  `;
  
  const idColumn = columns.find(c => c.column_name === 'id');
  await sql.end();

  if (idColumn?.data_type === 'text') {
    console.log(`   ✅ users.id is TEXT (Better Auth compatible)`);
    console.log(`   ℹ️  ${columns.length} columns in users table\n`);
  } else {
    console.log(`   ⚠️  users.id is ${idColumn?.data_type} (expected TEXT)\n`);
  }
} catch (error) {
  console.log(`   ⚠️  Could not verify user table: ${error.message}\n`);
}

// Test 4: R2 Storage Configuration
console.log('☁️  Testing R2 Storage Configuration...');
try {
  const hasR2 = Boolean(
    process.env.R2_ENDPOINT &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET
  );

  if (!hasR2) {
    throw new Error('R2 environment variables not set');
  }

  const { S3Client, PutObjectCommand, DeleteObjectCommand } = await import('@aws-sdk/client-s3');
  
  const client = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });

  const testKey = `healthcheck-${Date.now()}.txt`;
  
  // Upload test
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: testKey,
      Body: Buffer.from('Infrastructure verification test'),
      ContentType: 'text/plain',
    })
  );

  // Delete test
  await client.send(
    new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: testKey,
    })
  );

  results.storage.status = 'pass';
  results.storage.message = `R2 bucket: ${process.env.R2_BUCKET}`;
  console.log(`   ✅ R2 Storage: ${process.env.R2_BUCKET}`);
  console.log(`   ℹ️  Upload/Delete test successful\n`);
} catch (error) {
  results.storage.status = 'fail';
  results.storage.message = error.message;
  console.log(`   ❌ R2 Error: ${error.message}`);
  console.log(`   ℹ️  Will fall back to mock storage\n`);
}

// Test 5: Better Auth Configuration
console.log('🔐 Testing Better Auth Configuration...');
try {
  if (!process.env.BETTER_AUTH_SECRET) {
    throw new Error('BETTER_AUTH_SECRET not set');
  }

  if (!process.env.BETTER_AUTH_URL) {
    throw new Error('BETTER_AUTH_URL not set');
  }

  const secretLength = process.env.BETTER_AUTH_SECRET.length;
  if (secretLength < 32) {
    throw new Error(`Secret too short (${secretLength} chars, need 32+)`);
  }

  results.auth.status = 'pass';
  results.auth.message = `Configured (${secretLength} char secret)`;
  console.log(`   ✅ Better Auth: Configured`);
  console.log(`   ℹ️  URL: ${process.env.BETTER_AUTH_URL}`);
  console.log(`   ℹ️  Secret: ${secretLength} characters (${secretLength >= 64 ? 'strong' : 'adequate'})\n`);
} catch (error) {
  results.auth.status = 'fail';
  results.auth.message = error.message;
  console.log(`   ❌ Auth Error: ${error.message}\n`);
}

// Summary
console.log('📋 Summary\n');
console.log('┌─────────────────────┬──────────┬──────────────────────────────────────┐');
console.log('│ Component           │ Status   │ Details                              │');
console.log('├─────────────────────┼──────────┼──────────────────────────────────────┤');

for (const [name, result] of Object.entries(results)) {
  const statusIcon = result.status === 'pass' ? '✅' : result.status === 'warn' ? '⚠️' : '❌';
  const status = result.status.toUpperCase().padEnd(8);
  const message = result.message.substring(0, 36).padEnd(36);
  console.log(`│ ${name.padEnd(19)} │ ${statusIcon} ${status} │ ${message} │`);
}
console.log('└─────────────────────┴──────────┴──────────────────────────────────────┘');

const allPassed = Object.values(results).every(r => r.status === 'pass');
const hasWarnings = Object.values(results).some(r => r.status === 'warn');

if (allPassed) {
  console.log('\n✅ All infrastructure components verified successfully!\n');
  process.exit(0);
} else if (hasWarnings) {
  console.log('\n⚠️  Infrastructure verified with warnings. Review above.\n');
  process.exit(0);
} else {
  console.log('\n❌ Some infrastructure components failed. Review above.\n');
  process.exit(1);
}
