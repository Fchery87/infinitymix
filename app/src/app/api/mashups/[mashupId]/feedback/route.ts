import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { db } from '@/lib/db';
import { feedback, mashups } from '@/lib/db/schema';
import { feedbackSchema } from '@/lib/utils/validation';
import { eq, and, not } from 'drizzle-orm';

export async function POST(
  request: NextRequest,
  { params }: { params: { mashupId: string } }
) {
  try {
    const session = await auth.api.getSession({
      headers: new Headers(),
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { mashupId } = params;
    const body = await request.json();
    const { rating, comments } = feedbackSchema.parse(body);

    // Check if user owns this mashup
    const [mashup] = await db
      .select({ id: mashups.id })
      .from(mashups)
      .where(and(
        eq(mashups.id, mashupId),
        eq(mashups.userId, session.user.id)
      ));

    if (!mashup) {
      return NextResponse.json(
        { error: 'Mashup not found' },
        { status: 404 }
      );
    }

    // Check if feedback already exists
    const [existingFeedback] = await db
      .select({ id: feedback.id })
      .from(feedback)
      .where(and(
        eq(feedback.mashupId, mashupId),
        eq(feedback.userId, session.user.id)
      ));

    if (existingFeedback) {
      return NextResponse.json(
        { error: 'Feedback already submitted for this mashup' },
        { status: 409 }
      );
    }

    // Create feedback
    const [newFeedback] = await db
      .insert(feedback)
      .values({
        userId: session.user.id,
        mashupId,
        rating,
        comments: comments || null,
      })
      .returning();

    return NextResponse.json({
      id: newFeedback.id,
      user_id: newFeedback.userId,
      mashup_id: newFeedback.mashupId,
      rating: newFeedback.rating,
      comments: newFeedback.comments,
      created_at: newFeedback.createdAt,
    });
  } catch (error) {
    console.error('Submit feedback error:', error);
    
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation failed', details: (error as any).errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to submit feedback' },
      { status: 500 }
    );
  }
}
