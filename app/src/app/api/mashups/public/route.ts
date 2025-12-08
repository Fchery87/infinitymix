import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { mashups, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  const results = await db
    .select({
      id: mashups.id,
      name: mashups.name,
      userId: mashups.userId,
      isPublic: mashups.isPublic,
      publicSlug: mashups.publicSlug,
      playbackCount: mashups.playbackCount,
      downloadCount: mashups.downloadCount,
      outputStorageUrl: mashups.outputStorageUrl,
      outputFormat: mashups.outputFormat,
      createdAt: mashups.createdAt,
      ownerName: users.name,
      ownerImage: users.image,
    })
    .from(mashups)
    .leftJoin(users, eq(users.id, mashups.userId))
    .where(eq(mashups.isPublic, true))
    .orderBy(mashups.createdAt);

  return NextResponse.json({ mashups: results });
}
