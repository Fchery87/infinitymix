import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { mashups } from '@/lib/db/schema';
import { getSessionUser } from '@/lib/auth/session';
import { eq, and, desc } from 'drizzle-orm';

// GET /api/projects/[id]/mashups - Get all mashups in a project
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

    const projectMashups = await db
      .select()
      .from(mashups)
      .where(and(eq(mashups.projectId, id), eq(mashups.userId, user.id)))
      .orderBy(desc(mashups.createdAt));

    return NextResponse.json({ mashups: projectMashups });
  } catch (error) {
    console.error('Error fetching project mashups:', error);
    return NextResponse.json(
      { error: 'Failed to fetch mashups' },
      { status: 500 }
    );
  }
}
