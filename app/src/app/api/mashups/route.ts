import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { mashups } from '@/lib/db/schema';
import { log } from '@/lib/logger';
import { eq, desc, count } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
    const offset = (page - 1) * limit;

    const cacheControl = 'private, max-age=30';

    // Get total count
    const [totalCount] = await db
      .select({ count: count() })
      .from(mashups)
      .where(eq(mashups.userId, user.id));

    // Get mashups with pagination
    const userMashups = await db
      .select({
        id: mashups.id,
        userId: mashups.userId,
        name: mashups.name,
        targetDurationSeconds: mashups.targetDurationSeconds,
        generationStatus: mashups.generationStatus,
        outputStorageUrl: mashups.outputStorageUrl,
        outputFormat: mashups.outputFormat,
        generationTimeMs: mashups.generationTimeMs,
        playbackCount: mashups.playbackCount,
        downloadCount: mashups.downloadCount,
        isPublic: mashups.isPublic,
        publicSlug: mashups.publicSlug,
        parentMashupId: mashups.parentMashupId,
        createdAt: mashups.createdAt,
        updatedAt: mashups.updatedAt,
      })
      .from(mashups)
      .where(eq(mashups.userId, user.id))
      .orderBy(desc(mashups.createdAt))
      .limit(limit)
      .offset(offset);

    const formattedMashups = userMashups.map(mashup => ({
      id: mashup.id,
      user_id: mashup.userId,
      duration_seconds: mashup.targetDurationSeconds,
      status: mashup.generationStatus,
      output_path: mashup.outputStorageUrl,
      output_format: mashup.outputFormat,
      generation_time_ms: mashup.generationTimeMs,
      playback_count: mashup.playbackCount,
      download_count: mashup.downloadCount,
      is_public: mashup.isPublic,
      public_slug: mashup.publicSlug,
      parent_mashup_id: mashup.parentMashupId,
      created_at: mashup.createdAt,
      updated_at: mashup.updatedAt,
    }));

    const response = NextResponse.json({
      page,
      limit,
      total: totalCount.count,
      data: formattedMashups,
    });
    response.headers.set('Cache-Control', cacheControl);
    return response;
  } catch (error) {
    console.error('List mashups error:', error);
    log('error', 'mashups.list.failed', { error: (error as Error)?.message });
    return NextResponse.json(
      { error: 'Failed to retrieve mashups' },
      { status: 500 }
    );
  }
}
