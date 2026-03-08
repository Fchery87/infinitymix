import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiUser } from '@/lib/auth/admin';
import type { Experiment, ExperimentDomain } from '@/lib/experiments/types';

/**
 * GET /api/admin/experiments
 * 
 * List all experiments with their current status.
 * 
 * Query parameters:
 * - domain: Filter by domain (optional)
 * - status: Filter by status (optional)
 * 
 * Response:
 * {
 *   experiments: Array<{
 *     id: string;
 *     name: string;
 *     domain: string;
 *     status: string;
 *     startDate: string;
 *     variants: Array<{ name: string; trafficPercentage: number; isControl: boolean }>;
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
    const domainFilter = searchParams.get('domain') as ExperimentDomain | null;
    const statusFilter = searchParams.get('status');
    
    // In production, fetch from database
    // For now, return placeholder data
    const experiments: Experiment[] = [];
    
    // Filter experiments
    let filteredExperiments = experiments;
    if (domainFilter) {
      filteredExperiments = filteredExperiments.filter(e => e.domain === domainFilter);
    }
    if (statusFilter) {
      filteredExperiments = filteredExperiments.filter(e => e.status === statusFilter);
    }
    
    return NextResponse.json({
      experiments: filteredExperiments.map(e => ({
        id: e.id,
        name: e.name,
        domain: e.domain,
        status: e.status,
        startDate: e.startDate,
        endDate: e.endDate,
        trafficAllocation: e.trafficAllocation,
        variants: e.variants.map(v => ({
          id: v.id,
          name: v.name,
          trafficPercentage: v.trafficPercentage,
          isControl: v.isControl,
        })),
      })),
    });
  } catch (error) {
    console.error('Experiments list error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve experiments' },
      { status: 500 }
    );
  }
}
