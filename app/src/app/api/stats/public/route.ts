import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, mashups } from '@/lib/db/schema';
import { count, gte } from 'drizzle-orm';

export async function GET() {
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const [userCount] = await db
      .select({ value: count(users.id) })
      .from(users);

    const [weekMashups] = await db
      .select({ value: count(mashups.id) })
      .from(mashups)
      .where(gte(mashups.createdAt, oneWeekAgo));

    return NextResponse.json({
      userCount: userCount?.value ?? 0,
      mashupsThisWeek: weekMashups?.value ?? 0,
    });
  } catch {
    return NextResponse.json({ userCount: 0, mashupsThisWeek: 0 });
  }
}
