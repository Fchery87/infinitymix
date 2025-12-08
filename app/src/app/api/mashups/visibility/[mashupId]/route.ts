import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { mashups } from '@/lib/db/schema';
import { nanoid } from 'nanoid';
import { eq, and } from 'drizzle-orm';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ mashupId: string }> }) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { mashupId } = await params;
  if (!mashupId) return NextResponse.json({ error: 'mashupId is required' }, { status: 400 });

  if (!request.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 415 });
  }

  const body = await request.json().catch(() => null) as { isPublic?: boolean } | null;
  if (!body || typeof body.isPublic !== 'boolean') {
    return NextResponse.json({ error: 'isPublic boolean is required' }, { status: 400 });
  }

  const [existing] = await db
    .select({ id: mashups.id, publicSlug: mashups.publicSlug })
    .from(mashups)
    .where(and(eq(mashups.id, mashupId), eq(mashups.userId, user.id)))
    .limit(1);

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const slug = body.isPublic ? (existing.publicSlug ?? nanoid(16)) : null;

  const [updated] = await db
    .update(mashups)
    .set({
      isPublic: body.isPublic,
      publicSlug: slug,
      updatedAt: new Date(),
    })
    .where(eq(mashups.id, mashupId))
    .returning();

  return NextResponse.json({
    id: updated.id,
    is_public: updated.isPublic,
    public_slug: updated.publicSlug,
  });
}
