import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiUser } from '@/lib/auth/admin';
import { getQAStatistics, getRecentQAFailures } from '@/lib/audio/qa/persistence';

/**
 * GET /api/admin/qa/stats
 * 
 * Get QA statistics for admin dashboard.
 * 
 * Response:
 * {
 *   totalRecords: number;
 *   passedCount: number;
 *   failedCount: number;
 *   passRate: number;
 *   retryCount: number;
 *   needsReviewCount: number;
 *   averageRetryCount: number;
 * }
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdminApiUser(request);
  if (!admin.ok) {
    return admin.response;
  }

  try {
    const stats = await getQAStatistics();
    
    return NextResponse.json({
      ...stats,
      passRate: stats.totalRecords > 0 
        ? (stats.passedCount / stats.totalRecords) * 100 
        : 0,
    });
  } catch (error) {
    console.error('QA stats error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve QA statistics' },
      { status: 500 }
    );
  }
}
