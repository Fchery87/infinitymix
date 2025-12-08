import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { challenges } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    const active = await db
      .select()
      .from(challenges)
      .where(eq(challenges.status, 'active'));
    return NextResponse.json({ challenges: active });
  } catch (error) {
    console.error('challenges list error', error);
    return NextResponse.json({ error: 'Failed to load challenges' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const title = typeof body.title === 'string' ? body.title : 'Weekly Challenge';
    const prompt = typeof body.prompt === 'string' ? body.prompt : 'Submit your best mashup';

    const [challenge] = await db
      .insert(challenges)
      .values({
        title,
        prompt,
        status: 'active',
        startsAt: new Date(),
        createdByUserId: user.id,
      })
      .returning();

    return NextResponse.json({ challenge });
  } catch (error) {
    console.error('challenge create error', error);
    return NextResponse.json({ error: 'Failed to create challenge' }, { status: 500 });
  }
}
