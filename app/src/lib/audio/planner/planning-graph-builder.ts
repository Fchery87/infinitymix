/**
 * Planning Graph Builder
 * 
 * Constructs a planning graph from track data, including
 * track summaries and pairwise compatibility calculations.
 */

import { db } from '@/lib/db';
import { uploadedTracks, trackStems } from '@/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';
import type {
  PlanningGraph,
  TrackPlanningSummary,
  AsymmetricCompatibility,
  PlanningConstraints,
  PlanningPolicy,
} from '@/lib/audio/types/planner';
import { calculateEnergyProfile, calculateVocalDominance } from './track-analyzer';
import { calculateAsymmetricCompatibility } from './compatibility-scorer';
import { getDefaultPolicy } from './policy-rules';

/**
 * Build a planning graph from track IDs
 */
export async function buildPlanningGraph(
  trackIds: string[],
  constraints?: PlanningConstraints
): Promise<PlanningGraph> {
  if (trackIds.length < 2) {
    throw new Error('Planning graph requires at least 2 tracks');
  }

  // Fetch track data
  const tracks = await fetchTrackSummaries(trackIds);
  
  if (tracks.length !== trackIds.length) {
    const foundIds = new Set(tracks.map(t => t.trackId));
    const missingIds = trackIds.filter(id => !foundIds.has(id));
    throw new Error(`Tracks not found: ${missingIds.join(', ')}`);
  }

  // Calculate compatibilities for all pairs
  const compatibilities: AsymmetricCompatibility[] = [];
  
  for (let i = 0; i < tracks.length; i++) {
    for (let j = 0; j < tracks.length; j++) {
      if (i !== j) {
        const compat = await calculateAsymmetricCompatibility(
          tracks[i],
          tracks[j],
          constraints
        );
        compatibilities.push(compat);
      }
    }
  }

  // Build indices
  const trackIndex = new Map(tracks.map(t => [t.trackId, t]));
  const compatibilityIndex = new Map(
    compatibilities.map(c => [`${c.sourceTrackId}->${c.targetTrackId}`, c])
  );

  return {
    tracks,
    compatibilities,
    trackIndex,
    compatibilityIndex,
  };
}

/**
 * Fetch and transform track data into planning summaries
 */
async function fetchTrackSummaries(trackIds: string[]): Promise<TrackPlanningSummary[]> {
  const tracks = await db
    .select({
      id: uploadedTracks.id,
      durationSeconds: uploadedTracks.durationSeconds,
      bpm: uploadedTracks.bpm,
      camelotKey: uploadedTracks.camelotKey,
      structure: uploadedTracks.structure,
      cuePoints: uploadedTracks.cuePoints,
      beatGrid: uploadedTracks.beatGrid,
      waveformLite: uploadedTracks.waveformLite,
      analysisFeatures: uploadedTracks.analysisFeatures,
    })
    .from(uploadedTracks)
    .where(inArray(uploadedTracks.id, trackIds));

  // Fetch stem info for all tracks in one query
  const stems = await db
    .select({
      trackId: trackStems.uploadedTrackId,
      quality: trackStems.quality,
      status: trackStems.status,
    })
    .from(trackStems)
    .where(inArray(trackStems.uploadedTrackId, trackIds));

  const stemMap = new Map<string, { hasStems: boolean; quality: 'draft' | 'hifi' | null }>();
  
  for (const stem of stems) {
    const existing = stemMap.get(stem.trackId);
    if (!existing) {
      stemMap.set(stem.trackId, {
        hasStems: stem.status === 'completed',
        quality: stem.quality,
      });
    } else if (stem.status === 'completed') {
      existing.hasStems = true;
      // Prefer hifi quality if any stem has it
      if (stem.quality === 'hifi') {
        existing.quality = 'hifi';
      }
    }
  }

  return tracks.map(track => {
    const stemInfo = stemMap.get(track.id);
    const structure = track.structure ?? [];
    
    return {
      trackId: track.id,
      durationSeconds: track.durationSeconds ? Number(track.durationSeconds) : 0,
      bpm: track.bpm ? Number(track.bpm) : null,
      camelotKey: track.camelotKey,
      
      energyProfile: calculateEnergyProfile(
        track.waveformLite,
        track.analysisFeatures,
        structure
      ),
      
      structure: structure.map(s => ({
        label: s.label,
        start: s.start,
        end: s.end,
        energy: estimateSectionEnergy(s.label),
        confidence: s.confidence ?? 0.5,
      })),
      
      cuePoints: (track.cuePoints ?? []).map(cp => ({
        position: cp.position,
        type: cp.type,
        confidence: cp.confidence,
      })),
      
      hasStems: stemInfo?.hasStems ?? false,
      stemQuality: stemInfo?.quality ?? undefined,
      
      vocalDominance: calculateVocalDominance(
        track.analysisFeatures,
        structure
      ),
      
      hasClearVocalSections: structure.some(s => 
        s.label.includes('vocal') || s.label.includes('verse') || s.label.includes('chorus')
      ),
      
      hasClearInstrumentalSections: structure.some(s => 
        s.label.includes('intro') || s.label.includes('outro') || s.label === 'drop'
      ),
    };
  });
}

/**
 * Get compatibility between two specific tracks
 */
export function getCompatibility(
  graph: PlanningGraph,
  sourceTrackId: string,
  targetTrackId: string
): AsymmetricCompatibility | null {
  return graph.compatibilityIndex.get(`${sourceTrackId}->${targetTrackId}`) ?? null;
}

/**
 * Get all outbound compatibilities for a track
 */
export function getOutboundCompatibilities(
  graph: PlanningGraph,
  trackId: string
): AsymmetricCompatibility[] {
  return graph.compatibilities.filter(c => c.sourceTrackId === trackId);
}

/**
 * Get all inbound compatibilities for a track
 */
export function getInboundCompatibilities(
  graph: PlanningGraph,
  trackId: string
): AsymmetricCompatibility[] {
  return graph.compatibilities.filter(c => c.targetTrackId === trackId);
}

/**
 * Estimate energy level based on section label
 */
function estimateSectionEnergy(label: string): number {
  const energyMap: Record<string, number> = {
    'intro': 0.3,
    'verse': 0.5,
    'chorus': 0.7,
    'build': 0.6,
    'drop': 0.9,
    'breakdown': 0.4,
    'outro': 0.3,
    'body': 0.5,
  };

  return energyMap[label.toLowerCase()] ?? 0.5;
}
