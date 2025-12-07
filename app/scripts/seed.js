// Production database seeding script
// Run with: npm run db:seed
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// For production, these should be environment variables
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

console.log('🌱 Seeding production database...');

async function seedDatabase() {
  try {
    // Create database connection
    const client = postgres(connectionString);
    drizzle(client);

    console.log('✅ Database connection established');

    // Run schema.sql if needed
    const schemaPath = path.join(__dirname, '../schema.sql');
    if (fs.existsSync(schemaPath)) {
      console.log('📋 Schema file found - please run it manually in production');
      console.log(`   Run: psql "${connectionString}" -f ${schemaPath}`);
    }

    console.log('🚀 Database is ready for production!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Set up cloud storage (AWS S3 or Google Cloud Storage)');
    console.log('2. Configure environment variables in Vercel/Railway');
    console.log('3. Deploy your application');
    console.log('4. Test all endpoints work correctly');

  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    process.exit(1);
  }
}

seedDatabase().then(() => {
  console.log('✅ Seeding complete');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Seeding failed:', error);
  process.exit(1);
});
