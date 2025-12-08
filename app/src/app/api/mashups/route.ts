import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { db } from '@/lib/db';
import { mashups } from '@/lib/db/schema';
import { log } from '@/lib/logger';
import { eq, desc, count } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
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
      .where(eq(mashups.userId, session.user.id));

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
        createdAt: mashups.createdAt,
        updatedAt: mashups.updatedAt,
      })
      .from(mashups)
      .where(eq(mashups.userId, session.user.id))
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
