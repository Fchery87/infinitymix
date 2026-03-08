import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUser } from '@/lib/auth/session';
import { getAutomationJobsForUserResource } from '@/lib/runtime/jobs';

const querySchema = z.object({
  resourceKind: z.enum(['track', 'mashup']),
  resourceId: z.string().min(1),
  limit: z.coerce.number().min(1).max(50).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = querySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams.entries())
    );
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
    }

    const jobs = await getAutomationJobsForUserResource({
      userId: user.id,
      resourceKind: parsed.data.resourceKind,
      resourceId: parsed.data.resourceId,
      limit: parsed.data.limit,
    });

    return NextResponse.json({ jobs });
  } catch (error) {
    console.error('List automation jobs error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve automation jobs' },
      { status: 500 }
    );
  }
}
