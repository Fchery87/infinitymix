import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL);

const stems = await sql`SELECT id, uploaded_track_id, stem_type, status, engine, storage_url FROM track_stems ORDER BY created_at DESC LIMIT 10`;
console.table(stems);

await sql.end();
