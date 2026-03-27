import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { mashups, feedback } from '@/lib/db/schema';
import { eq, desc, sql, and, or, gte } from 'drizzle-orm';

export interface ActivityItem {
  id: string;
  type: 'mashup_created' | 'mashup_public' | 'mashup_downloaded' | 'mashup_played';
  title: string;
  description: string;
  mashupId: string | null;
  timestamp: string;
}

// GET /api/users/me/activity - Get recent user activity
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
    const limit = Math.min(20, Math.max(1, parseInt(searchParams.get('limit') ?? '10')));

    // Get recent mashups with activity indicators
    const recentMashups = await db
      .select({
        id: mashups.id,
        name: mashups.name,
        createdAt: mashups.createdAt,
        updatedAt: mashups.updatedAt,
        isPublic: mashups.isPublic,
        downloadCount: mashups.downloadCount,
        playbackCount: mashups.playbackCount,
        generationStatus: mashups.generationStatus,
      })
      .from(mashups)
      .where(eq(mashups.userId, user.id))
      .orderBy(desc(mashups.updatedAt))
      .limit(limit);

    const activities: ActivityItem[] = [];

    for (const mashup of recentMashups) {
      // Mashup created
      activities.push({
        id: `${mashup.id}-created`,
        type: 'mashup_created',
        title: 'Mashup created',
        description: `"${mashup.name}" was ${mashup.generationStatus === 'completed' ? 'completed' : 'started'}`,
        mashupId: mashup.id,
        timestamp: mashup.createdAt.toISOString(),
      });

      // Mashup made public
      if (mashup.isPublic) {
        activities.push({
          id: `${mashup.id}-public`,
          type: 'mashup_public',
          title: 'Made public',
          description: `"${mashup.name}" is now public`,
          mashupId: mashup.id,
          timestamp: mashup.updatedAt.toISOString(),
        });
      }

      // Mashup downloaded
      if (mashup.downloadCount > 0) {
        activities.push({
          id: `${mashup.id}-downloaded`,
          type: 'mashup_downloaded',
          title: 'Downloaded',
          description: `"${mashup.name}" downloaded ${mashup.downloadCount} time${mashup.downloadCount > 1 ? 's' : ''}`,
          mashupId: mashup.id,
          timestamp: mashup.updatedAt.toISOString(),
        });
      }

      // Mashup played
      if (mashup.playbackCount > 0) {
        activities.push({
          id: `${mashup.id}-played`,
          type: 'mashup_played',
          title: 'Played',
          description: `"${mashup.name}" played ${mashup.playbackCount} time${mashup.playbackCount > 1 ? 's' : ''}`,
          mashupId: mashup.id,
          timestamp: mashup.updatedAt.toISOString(),
        });
      }
    }

    // Sort by timestamp descending and limit
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({
      activities: activities.slice(0, limit),
    });
  } catch (error) {
    console.error('Get activity error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
