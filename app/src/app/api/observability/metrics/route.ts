import { NextResponse } from 'next/server';
import { getAudioPipelineFeatureFlags } from '@/lib/audio/feature-flags';
import { getBrowserHintThresholds } from '@/lib/audio/browser-hint-thresholds';
import { db } from '@/lib/db';
import { mashups, uploadedTracks } from '@/lib/db/schema';
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
  const thresholds = getBrowserHintThresholds();
  let audioAnalysisMetrics: {
    thresholds: {
      overallConfidence: number;
      bpmConfidence: number;
      keyConfidence: number;
    };
    qualityCounts: Record<string, number>;
    browserHintDecisionReasonCounts: Record<string, number>;
    completedTracks: number;
    browserHintTracks: number;
    browserHintAcceptanceRate: number | null;
    sectionTagging: {
      totalTracks: number;
      statusCounts: Record<string, number>;
      backendCounts: Record<string, number>;
      rolloutVariantCounts: Record<string, number>;
      fallbackReasonCounts: Record<string, number>;
      averageTotalMs: number | null;
      averageModelLoadMs: number | null;
      averageInferenceMs: number | null;
    };
    mashupGeneration: {
      plannerVariantCounts: Record<string, number>;
      averagePlanningDurationMs: number | null;
      averageRenderDurationMs: number | null;
      averageTempoStretchSeverity: number | null;
      averageHarmonicCompatibility: number | null;
      averageVocalCollisionSeverity: number | null;
      averageBeatAlignmentError: number | null;
      averageCuePointValidity: number | null;
      averageLoudnessLufs: number | null;
      averageTruePeakDb: number | null;
    };
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
      sectionTaggingRows,
      mashupTelemetryRows,
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
      db
        .select({
          analysisFeatures: uploadedTracks.analysisFeatures,
        })
        .from(uploadedTracks)
        .where(gte(uploadedTracks.createdAt, cutoff7d)),
      db
        .select({
          recommendationContext: mashups.recommendationContext,
        })
        .from(mashups)
        .where(gte(mashups.createdAt, cutoff7d)),
    ]);

    const sectionTaggingMetrics = {
      totalTracks: 0,
      statusCounts: {} as Record<string, number>,
      backendCounts: {} as Record<string, number>,
      rolloutVariantCounts: {} as Record<string, number>,
      fallbackReasonCounts: {} as Record<string, number>,
      averageTotalMs: null as number | null,
      averageModelLoadMs: null as number | null,
      averageInferenceMs: null as number | null,
    };
    const totalSamples: number[] = [];
    const modelLoadSamples: number[] = [];
    const inferenceSamples: number[] = [];

    for (const row of sectionTaggingRows) {
      const analysisFeatures =
        row.analysisFeatures && typeof row.analysisFeatures === 'object'
          ? (row.analysisFeatures as Record<string, unknown>)
          : null;
      const sectionTagging =
        analysisFeatures?.sectionTagging && typeof analysisFeatures.sectionTagging === 'object'
          ? (analysisFeatures.sectionTagging as Record<string, unknown>)
          : null;
      if (!sectionTagging) continue;

      sectionTaggingMetrics.totalTracks += 1;
      const status = typeof sectionTagging.status === 'string' ? sectionTagging.status : 'unknown';
      const backend = typeof sectionTagging.backend === 'string' ? sectionTagging.backend : 'unknown';
      const fallbackReason =
        typeof sectionTagging.fallbackReason === 'string' ? sectionTagging.fallbackReason : null;
      const rollout =
        sectionTagging.rollout && typeof sectionTagging.rollout === 'object'
          ? (sectionTagging.rollout as Record<string, unknown>)
          : null;
      const rolloutVariant = typeof rollout?.variant === 'string' ? rollout.variant : 'unknown';
      const timing =
        sectionTagging.timing && typeof sectionTagging.timing === 'object'
          ? (sectionTagging.timing as Record<string, unknown>)
          : null;

      sectionTaggingMetrics.statusCounts[status] =
        (sectionTaggingMetrics.statusCounts[status] ?? 0) + 1;
      sectionTaggingMetrics.backendCounts[backend] =
        (sectionTaggingMetrics.backendCounts[backend] ?? 0) + 1;
      sectionTaggingMetrics.rolloutVariantCounts[rolloutVariant] =
        (sectionTaggingMetrics.rolloutVariantCounts[rolloutVariant] ?? 0) + 1;
      if (fallbackReason) {
        sectionTaggingMetrics.fallbackReasonCounts[fallbackReason] =
          (sectionTaggingMetrics.fallbackReasonCounts[fallbackReason] ?? 0) + 1;
      }
      if (typeof timing?.totalMs === 'number') totalSamples.push(timing.totalMs);
      if (typeof timing?.modelLoadMs === 'number') modelLoadSamples.push(timing.modelLoadMs);
      if (typeof timing?.inferenceMs === 'number') inferenceSamples.push(timing.inferenceMs);
    }

    const average = (values: number[]) =>
      values.length > 0
        ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2))
        : null;
    sectionTaggingMetrics.averageTotalMs = average(totalSamples);
    sectionTaggingMetrics.averageModelLoadMs = average(modelLoadSamples);
    sectionTaggingMetrics.averageInferenceMs = average(inferenceSamples);

    const mashupGenerationMetrics = {
      plannerVariantCounts: {} as Record<string, number>,
      averagePlanningDurationMs: null as number | null,
      averageRenderDurationMs: null as number | null,
      averageTempoStretchSeverity: null as number | null,
      averageHarmonicCompatibility: null as number | null,
      averageVocalCollisionSeverity: null as number | null,
      averageBeatAlignmentError: null as number | null,
      averageCuePointValidity: null as number | null,
      averageLoudnessLufs: null as number | null,
      averageTruePeakDb: null as number | null,
    };
    const planningSamples: number[] = [];
    const renderSamples: number[] = [];
    const tempoStretchSamples: number[] = [];
    const harmonicCompatibilitySamples: number[] = [];
    const vocalCollisionSamples: number[] = [];
    const beatAlignmentSamples: number[] = [];
    const cuePointSamples: number[] = [];
    const loudnessSamples: number[] = [];
    const truePeakSamples: number[] = [];

    for (const row of mashupTelemetryRows) {
      const recommendationContext =
        row.recommendationContext && typeof row.recommendationContext === 'object'
          ? (row.recommendationContext as Record<string, unknown>)
          : null;
      if (!recommendationContext) continue;

      const plannerTelemetry =
        recommendationContext.plannerTelemetry &&
        typeof recommendationContext.plannerTelemetry === 'object'
          ? (recommendationContext.plannerTelemetry as Record<string, unknown>)
          : null;
      const renderTelemetry =
        recommendationContext.renderTelemetry &&
        typeof recommendationContext.renderTelemetry === 'object'
          ? (recommendationContext.renderTelemetry as Record<string, unknown>)
          : null;
      const plannerVariant =
        typeof plannerTelemetry?.plannerVariant === 'string'
          ? plannerTelemetry.plannerVariant
          : 'unknown';

      mashupGenerationMetrics.plannerVariantCounts[plannerVariant] =
        (mashupGenerationMetrics.plannerVariantCounts[plannerVariant] ?? 0) + 1;
      if (typeof plannerTelemetry?.planningDurationMs === 'number') {
        planningSamples.push(plannerTelemetry.planningDurationMs);
      }
      if (typeof renderTelemetry?.renderDurationMs === 'number') {
        renderSamples.push(renderTelemetry.renderDurationMs);
      }
      if (typeof plannerTelemetry?.tempoStretchSeverity === 'number') {
        tempoStretchSamples.push(plannerTelemetry.tempoStretchSeverity);
      }
      if (typeof plannerTelemetry?.harmonicCompatibility === 'number') {
        harmonicCompatibilitySamples.push(plannerTelemetry.harmonicCompatibility);
      }
      if (typeof plannerTelemetry?.vocalCollisionSeverity === 'number') {
        vocalCollisionSamples.push(plannerTelemetry.vocalCollisionSeverity);
      }
      if (typeof plannerTelemetry?.beatAlignmentError === 'number') {
        beatAlignmentSamples.push(plannerTelemetry.beatAlignmentError);
      }
      if (typeof plannerTelemetry?.cuePointValidity === 'number') {
        cuePointSamples.push(plannerTelemetry.cuePointValidity);
      }
      if (typeof renderTelemetry?.loudnessLufs === 'number') {
        loudnessSamples.push(renderTelemetry.loudnessLufs);
      }
      if (typeof renderTelemetry?.truePeakDb === 'number') {
        truePeakSamples.push(renderTelemetry.truePeakDb);
      }
    }

    mashupGenerationMetrics.averagePlanningDurationMs = average(planningSamples);
    mashupGenerationMetrics.averageRenderDurationMs = average(renderSamples);
    mashupGenerationMetrics.averageTempoStretchSeverity = average(tempoStretchSamples);
    mashupGenerationMetrics.averageHarmonicCompatibility = average(harmonicCompatibilitySamples);
    mashupGenerationMetrics.averageVocalCollisionSeverity = average(vocalCollisionSamples);
    mashupGenerationMetrics.averageBeatAlignmentError = average(beatAlignmentSamples);
    mashupGenerationMetrics.averageCuePointValidity = average(cuePointSamples);
    mashupGenerationMetrics.averageLoudnessLufs = average(loudnessSamples);
    mashupGenerationMetrics.averageTruePeakDb = average(truePeakSamples);

    const completedTracks = Number(totalsRaw[0]?.completedTracks ?? 0);
    const browserHintTracks = Number(totalsRaw[0]?.browserHintTracks ?? 0);
    audioAnalysisMetrics = {
      thresholds,
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
      sectionTagging: sectionTaggingMetrics,
      mashupGeneration: mashupGenerationMetrics,
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
