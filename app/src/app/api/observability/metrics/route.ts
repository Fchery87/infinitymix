import { NextResponse } from 'next/server';
import { getAudioPipelineFeatureFlags } from '@/lib/audio/feature-flags';
import { db } from '@/lib/db';
import { uploadedTracks } from '@/lib/db/schema';
import { gte, sql } from 'drizzle-orm';
import { requireAdminApiUser } from '@/lib/auth/admin';
import type { NextRequest } from 'next/server';

type TrendPoint = {
  bucket: string;
  label: string;
  completedTracks: number;
  browserHintTracks: number;
  acceptedTracks: number;
  fallbackTracks: number;
  acceptanceRate: number | null;
  reasonCounts: Record<string, number>;
};

type TrendTotalsRow = {
  bucket: string;
  completedTracks: number;
  browserHintTracks: number;
  acceptedTracks: number;
  fallbackTracks: number;
};

type TrendReasonRow = {
  bucket: string;
  reason: string | null;
  count: number;
};

function buildUtcHourBuckets(hours: number) {
  const now = new Date();
  const result: { bucket: string; label: string }[] = [];
  const end = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours(),
      0,
      0,
      0
    )
  );
  for (let i = hours - 1; i >= 0; i--) {
    const d = new Date(end.getTime() - i * 60 * 60 * 1000);
    const bucket = d.toISOString().slice(0, 13) + ':00:00Z';
    const label = d.toISOString().slice(11, 16);
    result.push({ bucket, label });
  }
  return result;
}

function buildUtcDayBuckets(days: number) {
  const now = new Date();
  const result: { bucket: string; label: string }[] = [];
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end.getTime() - i * 24 * 60 * 60 * 1000);
    const bucket = d.toISOString().slice(0, 10);
    const label = `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
    result.push({ bucket, label });
  }
  return result;
}

function mergeTrendSeries(
  bucketDefs: Array<{ bucket: string; label: string }>,
  totalsRows: TrendTotalsRow[],
  reasonRows: TrendReasonRow[]
): TrendPoint[] {
  const totalsByBucket = new Map(
    totalsRows.map((row) => [
      row.bucket,
      {
        completedTracks: Number(row.completedTracks ?? 0),
        browserHintTracks: Number(row.browserHintTracks ?? 0),
        acceptedTracks: Number(row.acceptedTracks ?? 0),
        fallbackTracks: Number(row.fallbackTracks ?? 0),
      },
    ])
  );
  const reasonsByBucket = new Map<string, Record<string, number>>();
  for (const row of reasonRows) {
    const bucket = row.bucket;
    const reason = row.reason ?? 'unknown';
    const current = reasonsByBucket.get(bucket) ?? {};
    current[reason] = (current[reason] ?? 0) + Number(row.count ?? 0);
    reasonsByBucket.set(bucket, current);
  }

  return bucketDefs.map(({ bucket, label }) => {
    const totals = totalsByBucket.get(bucket) ?? {
      completedTracks: 0,
      browserHintTracks: 0,
      acceptedTracks: 0,
      fallbackTracks: 0,
    };
    const acceptanceRate =
      totals.completedTracks > 0
        ? Number((totals.browserHintTracks / totals.completedTracks).toFixed(4))
        : null;
    return {
      bucket,
      label,
      ...totals,
      acceptanceRate,
      reasonCounts: reasonsByBucket.get(bucket) ?? {},
    };
  });
}

export async function GET(request: NextRequest) {
  const admin = await requireAdminApiUser(request);
  if (!admin.ok) {
    return admin.response;
  }

  const flags = getAudioPipelineFeatureFlags();
  let audioAnalysisMetrics: {
    qualityCounts: Record<string, number>;
    browserHintDecisionReasonCounts: Record<string, number>;
    completedTracks: number;
    browserHintTracks: number;
    browserHintAcceptanceRate: number | null;
    trends: {
      hourly24h: TrendPoint[];
      daily7d: TrendPoint[];
    };
  } | null = null;

  try {
    const now = new Date();
    const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const cutoff7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const hourlyBucketExpr = sql<string>`to_char(date_trunc('hour', ${uploadedTracks.createdAt} AT TIME ZONE 'UTC'), 'YYYY-MM-DD"T"HH24:00:00"Z"')`;
    const dailyBucketExpr = sql<string>`to_char(date_trunc('day', ${uploadedTracks.createdAt} AT TIME ZONE 'UTC'), 'YYYY-MM-DD')`;

    const [
      qualityCountsRaw,
      reasonCountsRaw,
      totalsRaw,
      hourlyTotalsRaw,
      hourlyReasonsRaw,
      dailyTotalsRaw,
      dailyReasonsRaw,
    ] = await Promise.all([
      db
        .select({
          analysisQuality: uploadedTracks.analysisQuality,
          count: sql<number>`count(*)`,
        })
        .from(uploadedTracks)
        .groupBy(uploadedTracks.analysisQuality),
      db
        .select({
          reason: uploadedTracks.browserHintDecisionReason,
          count: sql<number>`count(*)`,
        })
        .from(uploadedTracks)
        .groupBy(uploadedTracks.browserHintDecisionReason),
      db
        .select({
          completedTracks: sql<number>`count(*) filter (where ${uploadedTracks.analysisStatus} = 'completed')`,
          browserHintTracks: sql<number>`count(*) filter (where ${uploadedTracks.analysisQuality} = 'browser_hint')`,
        })
        .from(uploadedTracks),
      db
        .select({
          bucket: hourlyBucketExpr,
          completedTracks: sql<number>`count(*) filter (where ${uploadedTracks.analysisStatus} = 'completed')`,
          browserHintTracks: sql<number>`count(*) filter (where ${uploadedTracks.analysisQuality} = 'browser_hint')`,
          acceptedTracks: sql<number>`count(*) filter (where ${uploadedTracks.browserHintDecisionReason} = 'accepted')`,
          fallbackTracks: sql<number>`count(*) filter (where ${uploadedTracks.browserHintDecisionReason} is not null and ${uploadedTracks.browserHintDecisionReason} <> 'accepted')`,
        })
        .from(uploadedTracks)
        .where(gte(uploadedTracks.createdAt, cutoff24h))
        .groupBy(hourlyBucketExpr)
        .orderBy(hourlyBucketExpr),
      db
        .select({
          bucket: hourlyBucketExpr,
          reason: uploadedTracks.browserHintDecisionReason,
          count: sql<number>`count(*)`,
        })
        .from(uploadedTracks)
        .where(gte(uploadedTracks.createdAt, cutoff24h))
        .groupBy(hourlyBucketExpr, uploadedTracks.browserHintDecisionReason)
        .orderBy(hourlyBucketExpr),
      db
        .select({
          bucket: dailyBucketExpr,
          completedTracks: sql<number>`count(*) filter (where ${uploadedTracks.analysisStatus} = 'completed')`,
          browserHintTracks: sql<number>`count(*) filter (where ${uploadedTracks.analysisQuality} = 'browser_hint')`,
          acceptedTracks: sql<number>`count(*) filter (where ${uploadedTracks.browserHintDecisionReason} = 'accepted')`,
          fallbackTracks: sql<number>`count(*) filter (where ${uploadedTracks.browserHintDecisionReason} is not null and ${uploadedTracks.browserHintDecisionReason} <> 'accepted')`,
        })
        .from(uploadedTracks)
        .where(gte(uploadedTracks.createdAt, cutoff7d))
        .groupBy(dailyBucketExpr)
        .orderBy(dailyBucketExpr),
      db
        .select({
          bucket: dailyBucketExpr,
          reason: uploadedTracks.browserHintDecisionReason,
          count: sql<number>`count(*)`,
        })
        .from(uploadedTracks)
        .where(gte(uploadedTracks.createdAt, cutoff7d))
        .groupBy(dailyBucketExpr, uploadedTracks.browserHintDecisionReason)
        .orderBy(dailyBucketExpr),
    ]);

    const completedTracks = Number(totalsRaw[0]?.completedTracks ?? 0);
    const browserHintTracks = Number(totalsRaw[0]?.browserHintTracks ?? 0);
    audioAnalysisMetrics = {
      qualityCounts: Object.fromEntries(
        qualityCountsRaw.map((row) => [row.analysisQuality ?? 'unknown', Number(row.count ?? 0)])
      ),
      browserHintDecisionReasonCounts: Object.fromEntries(
        reasonCountsRaw.map((row) => [row.reason ?? 'unknown', Number(row.count ?? 0)])
      ),
      completedTracks,
      browserHintTracks,
      browserHintAcceptanceRate:
        completedTracks > 0 ? Number((browserHintTracks / completedTracks).toFixed(4)) : null,
      trends: {
        hourly24h: mergeTrendSeries(
          buildUtcHourBuckets(24),
          hourlyTotalsRaw as TrendTotalsRow[],
          hourlyReasonsRaw as TrendReasonRow[]
        ),
        daily7d: mergeTrendSeries(
          buildUtcDayBuckets(7),
          dailyTotalsRaw as TrendTotalsRow[],
          dailyReasonsRaw as TrendReasonRow[]
        ),
      },
    };
  } catch (error) {
    console.error('Failed to compute audio observability metrics', error);
  }

  return NextResponse.json({
    status: 'ok',
    timestamp: Date.now(),
    metrics: {
      audioPipeline: {
        featureFlags: flags,
        analysis: audioAnalysisMetrics,
      },
    },
  });
}
