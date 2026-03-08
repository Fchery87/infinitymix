import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { getAutomationJobForUser } from '@/lib/runtime/jobs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const user = await getSessionUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { jobId } = await params;
    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    const job = await getAutomationJobForUser({ jobId, userId: user.id });
    if (!job) {
      return NextResponse.json({ error: 'Automation job not found' }, { status: 404 });
    }

    return NextResponse.json(job);
  } catch (error) {
    console.error('Get automation job error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve automation job' },
      { status: 500 }
    );
  }
}
