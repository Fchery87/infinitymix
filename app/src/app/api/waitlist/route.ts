import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { waitlist } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const waitlistSchema = z.object({
  email: z.string().email('Valid email is required'),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = waitlistSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const existing = await db
      .select()
      .from(waitlist)
      .where(eq(waitlist.email, parsed.data.email))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({ message: 'You\'re already on the waitlist!' });
    }

    await db.insert(waitlist).values({ email: parsed.data.email });

    return NextResponse.json(
      { message: 'Successfully joined the waitlist!' },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
