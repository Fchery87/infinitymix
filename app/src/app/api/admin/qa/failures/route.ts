import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiUser } from '@/lib/auth/admin';
import { getRecentQAFailures } from '@/lib/audio/qa/persistence';

/**
 * GET /api/admin/qa/failures
 * 
 * Get recent QA failures for admin review.
 * 
 * Query parameters:
 * - limit: Maximum number of results (default 50, max 100)
 * 
 * Response:
 * {
 *   failures: Array<{
 *     id: string;
 *     jobId: string;
 *     mashupId: string;
 *     userId: string;
 *     userEmail?: string;
 *     passed: boolean;
 *     retryCount: number;
 *     retryReasons: string[];
 *     results: AutomationQAResults;
 *     createdAt: string;
 *   }>;
 * }
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdminApiUser(request);
  if (!admin.ok) {
    return admin.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    
    const failures = await getRecentQAFailures(limit);
    
    return NextResponse.json({ failures });
  } catch (error) {
    console.error('QA failures error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve QA failures' },
      { status: 500 }
    );
  }
}
