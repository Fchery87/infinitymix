/**
 * Asymmetric Compatibility Scorer
 * 
 * Calculates directional compatibility scores between tracks,
 * considering different use cases (vocal over instrumental, etc.)
 */

import type {
  TrackPlanningSummary,
  AsymmetricCompatibility,
  TransitionStyle,
  PlanningConstraints,
} from '@/lib/audio/types/planner';
import { camelotCompatible, bpmCompatibility } from '@/lib/utils/audio-compat';

/**
 * Calculate asymmetric compatibility between two tracks
 */
export async function calculateAsymmetricCompatibility(
  source: TrackPlanningSummary,
  target: TrackPlanningSummary,
  constraints?: PlanningConstraints
): Promise<AsymmetricCompatibility> {
  // Calculate base scores
  const tempoCompat = calculateTempoCompatibility(source, target, constraints);
  const harmonicCompat = calculateHarmonicCompatibility(source, target);
  const energyFlow = calculateEnergyFlowScore(source, target);
  
  // Calculate role-aware scores
  const vocalOverInst = calculateVocalOverInstrumentalScore(source, target);
  const instOverVocal = calculateInstrumentalOverVocalScore(source, target);
  const fullTrackTrans = calculateFullTrackTransitionScore(source, target);
  
  // Calculate penalties
  const tempoStretchPenalty = calculateTempoStretchPenalty(source, target, constraints);
  const stemQualityPenalty = calculateStemQualityPenalty(source, target);
  const harmonicClash = 1 - harmonicCompat;
  const vocalCollision = estimateVocalCollisionRisk(source, target);
  
  // Apply penalties to get final scores
  const applyPenalties = (baseScore: number) => {
    return Math.max(0, baseScore - tempoStretchPenalty - stemQualityPenalty);
  };
  
  const scores = {
    'lead-vocal_to_lead-instrumental': applyPenalties(vocalOverInst),
    'lead-instrumental_to_lead-vocal': applyPenalties(instOverVocal),
    'full-mix_to_full-mix': applyPenalties(fullTrackTrans),
    'lead-vocal_to_full-mix': applyPenalties((vocalOverInst + fullTrackTrans) / 2),
    'full-mix_to_lead-instrumental': applyPenalties((instOverVocal + fullTrackTrans) / 2),
  };
  
  // Determine best transition style
  const suggestedStyle = suggestTransitionStyle(source, target, scores);
  const suggestedOverlap = suggestOverlapDuration(source, target, suggestedStyle);
  
  return {
    sourceTrackId: source.trackId,
    targetTrackId: target.trackId,
    
    tempoCompatibility: tempoCompat,
    harmonicCompatibility: harmonicCompat,
    energyFlowScore: energyFlow,
    
    vocalOverInstrumentalScore: vocalOverInst,
    instrumentalOverVocalScore: instOverVocal,
    fullTrackTransitionScore: fullTrackTrans,
    
    tempoStretchPenalty,
    stemQualityPenalty,
    harmonicClashSeverity: harmonicClash,
    vocalCollisionRisk: vocalCollision,
    
    scores,
    suggestedTransitionStyle: suggestedStyle,
    suggestedOverlapDuration: suggestedOverlap,
  };
}

/**
 * Calculate tempo compatibility between two tracks
 */
function calculateTempoCompatibility(
  source: TrackPlanningSummary,
  target: TrackPlanningSummary,
  constraints?: PlanningConstraints
): number {
  if (!source.bpm || !target.bpm) return 0.5;
  
  const { score } = bpmCompatibility(source.bpm, target.bpm);
  
  // Apply constraint penalties
  if (constraints?.maxTempoStretchPercent) {
    const ratio = target.bpm / source.bpm;
    const stretchPercent = Math.abs(ratio - 1) * 100;
    if (stretchPercent > constraints.maxTempoStretchPercent) {
      return score * 0.5; // Heavy penalty for exceeding stretch limit
    }
  }
  
  return score;
}

/**
 * Calculate harmonic compatibility using Camelot wheel
 */
function calculateHarmonicCompatibility(
  source: TrackPlanningSummary,
  target: TrackPlanningSummary
): number {
  if (!source.camelotKey || !target.camelotKey) return 0.5;
  
  return camelotCompatible(source.camelotKey, target.camelotKey) ? 1 : 0;
}

/**
 * Calculate how well energy flows from source to target
 */
function calculateEnergyFlowScore(
  source: TrackPlanningSummary,
  target: TrackPlanningSummary
): number {
  // Ideal: peak energy at end of source, valley at start of target
  // This creates a natural breathing point
  
  const sourceEnergy = source.energyProfile.peakEnergy;
  const targetEnergy = target.energyProfile.valleyEnergy;
  
  // Score high if source is energetic and target starts calm
  let score = (sourceEnergy + (1 - targetEnergy)) / 2;
  
  // Bonus for complementary energy profiles
  const energyDiff = Math.abs(source.energyProfile.averageEnergy - target.energyProfile.averageEnergy);
  if (energyDiff > 0.3) {
    score += 0.1; // Slight bonus for contrast
  }
  
  return Math.min(1, score);
}

/**
 * Score for using source as vocal over target as instrumental
 */
function calculateVocalOverInstrumentalScore(
  source: TrackPlanningSummary,
  target: TrackPlanningSummary
): number {
  let score = 0.5;
  
  // Source should be vocal-dominant
  if (source.vocalDominance > 0.6) {
    score += 0.2;
  }
  if (source.hasClearVocalSections) {
    score += 0.1;
  }
  
  // Target should be instrumental-friendly
  if (target.vocalDominance < 0.4) {
    score += 0.2;
  }
  if (target.hasClearInstrumentalSections) {
    score += 0.1;
  }
  
  // Check for clear instrumental sections in target
  const instSections = target.structure.filter(s => 
    s.label === 'intro' || s.label === 'outro' || s.label === 'body'
  );
  if (instSections.length > 0) {
    score += 0.1;
  }
  
  return Math.min(1, score);
}

/**
 * Score for using source as instrumental under target as vocal
 */
function calculateInstrumentalOverVocalScore(
  source: TrackPlanningSummary,
  target: TrackPlanningSummary
): number {
  // This is essentially the inverse of vocal-over-instrumental
  // but we recalculate to allow for asymmetric preferences
  
  let score = 0.5;
  
  // Source should be instrumental-friendly
  if (source.vocalDominance < 0.4) {
    score += 0.2;
  }
  if (source.hasClearInstrumentalSections) {
    score += 0.1;
  }
  
  // Target should be vocal-dominant
  if (target.vocalDominance > 0.6) {
    score += 0.2;
  }
  if (target.hasClearVocalSections) {
    score += 0.1;
  }
  
  // Prefer target with clear vocal sections
  const vocalSections = target.structure.filter(s => 
    s.label === 'verse' || s.label === 'chorus'
  );
  if (vocalSections.length > 0) {
    score += 0.1;
  }
  
  return Math.min(1, score);
}

/**
 * Score for full-track transition (no stem separation)
 */
function calculateFullTrackTransitionScore(
  source: TrackPlanningSummary,
  target: TrackPlanningSummary
): number {
  let score = 0.6; // Base score
  
  // Penalty if both are very vocal-heavy (collision risk)
  if (source.vocalDominance > 0.7 && target.vocalDominance > 0.7) {
    score -= 0.3;
  }
  
  // Bonus if they have complementary sections
  const sourceHasInst = source.hasClearInstrumentalSections;
  const targetHasInst = target.hasClearInstrumentalSections;
  
  if (sourceHasInst || targetHasInst) {
    score += 0.1;
  }
  
  // Bonus for compatible cue points
  const sourceMixOut = source.cuePoints.find(cp => cp.type === 'mix-out');
  const targetMixIn = target.cuePoints.find(cp => cp.type === 'mix-in');
  
  if (sourceMixOut && targetMixIn) {
    score += 0.1;
  }
  
  return Math.max(0, Math.min(1, score));
}

/**
 * Calculate penalty for aggressive tempo stretching
 */
function calculateTempoStretchPenalty(
  source: TrackPlanningSummary,
  target: TrackPlanningSummary,
  constraints?: PlanningConstraints
): number {
  if (!source.bpm || !target.bpm) return 0;
  
  const ratio = target.bpm / source.bpm;
  const stretchPercent = Math.abs(ratio - 1) * 100;
  
  // Soft penalty starts at 3%, increases quadratically
  if (stretchPercent < 3) return 0;
  
  const maxAllowed = constraints?.maxTempoStretchPercent ?? 10;
  if (stretchPercent > maxAllowed) {
    return 0.5; // Hard penalty
  }
  
  // Gradual penalty
  return Math.pow((stretchPercent - 3) / (maxAllowed - 3), 2) * 0.3;
}

/**
 * Calculate penalty for low stem quality
 */
function calculateStemQualityPenalty(
  source: TrackPlanningSummary,
  target: TrackPlanningSummary
): number {
  let penalty = 0;
  
  // If using stems, quality matters
  if (source.hasStems && source.stemQuality === 'draft') {
    penalty += 0.1;
  }
  if (target.hasStems && target.stemQuality === 'draft') {
    penalty += 0.1;
  }
  
  return penalty;
}

/**
 * Estimate risk of vocal collision
 */
function estimateVocalCollisionRisk(
  source: TrackPlanningSummary,
  target: TrackPlanningSummary
): number {
  // High risk if both tracks are vocal-dominant
  if (source.vocalDominance > 0.7 && target.vocalDominance > 0.7) {
    return 0.8;
  }
  
  // Medium risk if both have significant vocals
  if (source.vocalDominance > 0.5 && target.vocalDominance > 0.5) {
    return 0.5;
  }
  
  // Low risk otherwise
  return 0.2;
}

/**
 * Suggest the best transition style for this pair
 */
function suggestTransitionStyle(
  source: TrackPlanningSummary,
  target: TrackPlanningSummary,
  scores: AsymmetricCompatibility['scores']
): TransitionStyle {
  const vocalOverInst = scores['lead-vocal_to_lead-instrumental'];
  const instOverVocal = scores['lead-instrumental_to_lead-vocal'];
  const fullMix = scores['full-mix_to_full-mix'];
  
  // If vocal roles are clear, use vocal handoff
  if (vocalOverInst > 0.8 || instOverVocal > 0.8) {
    return 'vocal-handoff';
  }
  
  // Check for drops in either track
  const hasDrop = [...source.structure, ...target.structure].some(s => s.label === 'drop');
  if (hasDrop && fullMix > 0.7) {
    return 'bass-drop';
  }
  
  // Check for build sections
  const hasBuild = [...source.structure, ...target.structure].some(s => s.label === 'build');
  if (hasBuild) {
    return 'energy-build';
  }
  
  // Default to phrase-aligned fade
  return 'phrase-snap';
}

/**
 * Suggest overlap duration based on transition style and track characteristics
 */
function suggestOverlapDuration(
  source: TrackPlanningSummary,
  target: TrackPlanningSummary,
  style: TransitionStyle
): number {
  const baseDurations: Record<TransitionStyle, number> = {
    'cut': 0.1,
    'fade': 4,
    'echo-reverb': 6,
    'filter-sweep': 8,
    'energy-build': 8,
    'bass-drop': 4,
    'vocal-handoff': 6,
    'phrase-snap': 4,
  };
  
  let duration = baseDurations[style] ?? 4;
  
  // Adjust based on tempo (slower tracks need longer transitions)
  const avgBpm = ((source.bpm ?? 120) + (target.bpm ?? 120)) / 2;
  if (avgBpm < 90) {
    duration *= 1.3;
  } else if (avgBpm > 140) {
    duration *= 0.8;
  }
  
  // Ensure overlap doesn't exceed track lengths
  const minTrackLength = Math.min(
    source.durationSeconds * 0.5,
    target.durationSeconds * 0.5
  );
  
  return Math.min(duration, minTrackLength);
}
