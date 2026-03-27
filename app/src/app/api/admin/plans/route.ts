import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { plans } from '@/lib/db/schema';
import { asc } from 'drizzle-orm';

export async function GET() {
  try {
    const allPlans = await db
      .select()
      .from(plans)
      .orderBy(asc(plans.priceCents));

    return NextResponse.json({ plans: allPlans });
  } catch {
    return NextResponse.json({ plans: [] }, { status: 500 });
  }
}
