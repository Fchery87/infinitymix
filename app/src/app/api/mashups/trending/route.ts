import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { mashups, users } from '@/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';

export async function GET() {
  const popularity = sql`(${mashups.playbackCount} * 1.0 + ${mashups.downloadCount} * 1.5)`;

  const results = await db
    .select({
      id: mashups.id,
      name: mashups.name,
      userId: mashups.userId,
      publicSlug: mashups.publicSlug,
      playbackCount: mashups.playbackCount,
      downloadCount: mashups.downloadCount,
      outputStorageUrl: mashups.outputStorageUrl,
      outputFormat: mashups.outputFormat,
      createdAt: mashups.createdAt,
      popularity,
      ownerName: users.name,
      ownerImage: users.image,
    })
    .from(mashups)
    .leftJoin(users, eq(users.id, mashups.userId))
    .where(eq(mashups.isPublic, true))
    .orderBy(desc(popularity), desc(mashups.createdAt))
    .limit(20);

  return NextResponse.json({ mashups: results });
}
