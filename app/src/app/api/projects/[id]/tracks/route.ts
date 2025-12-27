import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { uploadedTracks } from '@/lib/db/schema';
import { getSessionUser } from '@/lib/auth/session';
import { eq, and } from 'drizzle-orm';

// GET /api/projects/[id]/tracks - Get all tracks in a project
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getSessionUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tracks = await db
      .select()
      .from(uploadedTracks)
      .where(
        and(
          eq(uploadedTracks.projectId, id),
          eq(uploadedTracks.userId, user.id)
        )
      )
      .orderBy(uploadedTracks.createdAt);

    return NextResponse.json({ tracks });
  } catch (error) {
    console.error('Error fetching project tracks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tracks' },
      { status: 500 }
    );
  }
}
