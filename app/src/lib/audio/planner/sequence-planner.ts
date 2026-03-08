/**
 * Sequence Planner Service
 * 
 * Main service for planning track sequences with role assignment,
 * transition planning, and comprehensive trace generation.
 */

import { nanoid } from 'nanoid';
import type {
  PlanSequenceInput,
  PlanSequenceOutput,
  PlanningGraph,
  SequencePlan,
  PlannerTrace,
  TrackRole,
  PlannedTransition,
  PlanningPolicy,
  PlanningConstraints,
  TrackPlanningSummary,
  AsymmetricCompatibility,
} from '@/lib/audio/types/planner';
import { buildPlanningGraph, getCompatibility } from './planning-graph-builder';
import { getPolicyForArchetype, isTransitionAllowed, validateEnergyArc } from './policy-rules';
import { getBestCuePoint } from './track-analyzer';

/**
 * Main entry point: plan a sequence of tracks
 */
export async function planSequence(
  input: PlanSequenceInput
): Promise<PlanSequenceOutput> {
  const startTime = Date.now();
  const planId = nanoid();
  const traceId = nanoid();
  
  // Initialize policy
  const policy = input.policy?.energyArcPolicy?.type
    ? getPolicyForArchetype(input.policy.energyArcPolicy.type)
    : getPolicyForArchetype('warmup-journey');
  
  // Merge any policy overrides
  if (input.policy) {
    Object.assign(policy, input.policy);
  }
  
  const trace: PlannerTrace = {
    traceId,
    planId,
    createdAt: new Date().toISOString(),
    inputTrackCount: input.trackIds.length,
    constraints: input.constraints,
    policy,
    steps: [],
    decisions: [],
    rejectedCandidates: [],
    warnings: [],
    totalPlanningDurationMs: 0,
    graphBuildDurationMs: 0,
    compatibilityScoringDurationMs: 0,
    sequenceOptimizationDurationMs: 0,
  };
  
  try {
    // Step 1: Build planning graph
    const graphStart = Date.now();
    const graph = await buildPlanningGraph(input.trackIds, input.constraints);
    trace.graphBuildDurationMs = Date.now() - graphStart;
    trace.steps.push({
      stepNumber: 1,
      stepType: 'build_graph',
      durationMs: trace.graphBuildDurationMs,
      details: { trackCount: graph.tracks.length, compatibilityCount: graph.compatibilities.length },
    });
    
    // Step 2: Select sequence order
    const seqStart = Date.now();
    const { sequence, sequenceDecisions } = selectSequenceOrder(graph, policy, input.constraints);
    trace.sequenceOptimizationDurationMs = Date.now() - seqStart;
    trace.steps.push({
      stepNumber: 2,
      stepType: 'select_sequence',
      durationMs: trace.sequenceOptimizationDurationMs,
      details: { sequenceLength: sequence.length },
    });
    trace.decisions.push(...sequenceDecisions);
    
    // Step 3: Assign roles
    const { roles, roleDecisions } = assignRoles(graph, sequence, policy);
    trace.steps.push({
      stepNumber: 3,
      stepType: 'assign_roles',
      durationMs: 0,
      details: { roles },
    });
    trace.decisions.push(...roleDecisions);
    
    // Step 4: Plan transitions
    const { transitions, transitionDecisions } = planTransitions(graph, sequence, roles, policy);
    trace.steps.push({
      stepNumber: 4,
      stepType: 'plan_transitions',
      durationMs: 0,
      details: { transitionCount: transitions.length },
    });
    trace.decisions.push(...transitionDecisions);
    
    // Step 5: Validate
    const validationResult = validatePlan(graph, sequence, transitions, policy);
    trace.steps.push({
      stepNumber: 5,
      stepType: 'validate',
      durationMs: 0,
      details: validationResult,
    });
    trace.warnings.push(...validationResult.warnings);
    
    // Build final plan
    const plan = buildSequencePlan(planId, sequence, roles, transitions, graph);
    
    trace.totalPlanningDurationMs = Date.now() - startTime;
    
    return {
      plan,
      trace,
    };
  } catch (error) {
    trace.totalPlanningDurationMs = Date.now() - startTime;
    trace.warnings.push({
      type: 'planning_error',
      message: error instanceof Error ? error.message : 'Unknown error',
      severity: 'high',
    });
    throw error;
  }
}

/**
 * Select the optimal sequence order using a greedy TSP-like approach
 */
function selectSequenceOrder(
  graph: PlanningGraph,
  policy: PlanningPolicy,
  constraints?: PlanningConstraints
): { sequence: TrackPlanningSummary[]; sequenceDecisions: PlannerTrace['decisions'] } {
  const decisions: PlannerTrace['decisions'] = [];
  
  if (graph.tracks.length === 0) {
    return { sequence: [], sequenceDecisions: decisions };
  }
  
  // Start with the track that has the best "opening" characteristics
  let currentTrack = selectOpeningTrack(graph.tracks);
  const sequence: TrackPlanningSummary[] = [currentTrack];
  const remaining = new Set(graph.tracks.filter(t => t.trackId !== currentTrack.trackId));
  
  while (remaining.size > 0) {
    let bestNext: TrackPlanningSummary | null = null;
    let bestScore = -Infinity;
    let rejected: PlannerTrace['decisions'][0]['rejected'] = [];
    
    for (const candidate of remaining) {
      const compat = getCompatibility(graph, currentTrack.trackId, candidate.trackId);
      if (!compat) continue;
      
      // Check safety rules
      const safetyCheck = isTransitionAllowed(compat, policy);
      if (!safetyCheck.allowed) {
        rejected.push({
          option: candidate.trackId,
          reason: safetyCheck.reason ?? 'Safety rule violation',
          score: 0,
        });
        continue;
      }
      
      // Calculate score (prefer full-mix transitions for now)
      const score = compat.scores['full-mix_to_full-mix'];
      
      if (score > bestScore) {
        if (bestNext) {
          rejected.push({
            option: bestNext.trackId,
            reason: 'Lower compatibility score',
            score: bestScore,
          });
        }
        bestScore = score;
        bestNext = candidate;
      } else {
        rejected.push({
          option: candidate.trackId,
          reason: 'Lower compatibility score',
          score,
        });
      }
    }
    
    let selectedNext: TrackPlanningSummary;
    
    if (!bestNext) {
      // No valid transition found, pick arbitrarily
      const arbitraryNext = remaining.values().next().value;
      if (!arbitraryNext) break; // Shouldn't happen but type safety
      
      selectedNext = arbitraryNext;
      decisions.push({
        decisionType: 'sequence_order',
        trackIds: [currentTrack.trackId, selectedNext.trackId],
        chosen: selectedNext.trackId,
        rejected,
        rationale: 'No valid transition found, selected arbitrarily',
      });
    } else {
      selectedNext = bestNext;
      decisions.push({
        decisionType: 'sequence_order',
        trackIds: [currentTrack.trackId, selectedNext.trackId],
        chosen: selectedNext.trackId,
        rejected,
        rationale: `Best compatibility score: ${bestScore.toFixed(3)}`,
      });
    }
    
    sequence.push(selectedNext);
    remaining.delete(selectedNext);
    currentTrack = selectedNext;
  }
  
  return { sequence, sequenceDecisions: decisions };
}

/**
 * Select the best track to open the sequence
 */
function selectOpeningTrack(tracks: TrackPlanningSummary[]): TrackPlanningSummary {
  // Prefer tracks with:
  // 1. Clear intro section
  // 2. Lower energy (build up from here)
  // 3. Good cue points
  
  const scored = tracks.map(track => {
    let score = 0.5;
    
    // Bonus for having an intro
    if (track.structure.some(s => s.label === 'intro')) {
      score += 0.2;
    }
    
    // Prefer lower energy for opening
    score += (0.5 - track.energyProfile.averageEnergy) * 0.3;
    
    // Bonus for having a mix-in cue point
    if (track.cuePoints.some(cp => cp.type === 'mix-in')) {
      score += 0.1;
    }
    
    return { track, score };
  });
  
  scored.sort((a, b) => b.score - a.score);
  return scored[0].track;
}

/**
 * Assign roles to tracks in the sequence
 */
function assignRoles(
  graph: PlanningGraph,
  sequence: TrackPlanningSummary[],
  policy: PlanningPolicy
): { roles: Map<string, TrackRole>; roleDecisions: PlannerTrace['decisions'] } {
  const roles = new Map<string, TrackRole>();
  const decisions: PlannerTrace['decisions'] = [];
  
  // Simple role assignment: alternate between full-mix and stem roles if available
  for (let i = 0; i < sequence.length; i++) {
    const track = sequence[i];
    let role: TrackRole = 'full-mix';
    
    if (policy.stemUsagePolicy.useStemsWhenAvailable && track.hasStems) {
      // Decide based on vocal dominance and position
      if (track.vocalDominance > 0.6) {
        role = 'lead-vocal';
      } else if (track.vocalDominance < 0.4) {
        role = 'lead-instrumental';
      }
    }
    
    roles.set(track.trackId, role);
    
    decisions.push({
      decisionType: 'role_assignment',
      trackIds: [track.trackId],
      chosen: role,
      rejected: [],
      rationale: `Vocal dominance: ${track.vocalDominance}, stems available: ${track.hasStems}`,
    });
  }
  
  return { roles, roleDecisions: decisions };
}

/**
 * Plan transitions between consecutive tracks
 */
function planTransitions(
  graph: PlanningGraph,
  sequence: TrackPlanningSummary[],
  roles: Map<string, TrackRole>,
  policy: PlanningPolicy
): { transitions: PlannedTransition[]; transitionDecisions: PlannerTrace['decisions'] } {
  const transitions: PlannedTransition[] = [];
  const decisions: PlannerTrace['decisions'] = [];
  
  for (let i = 0; i < sequence.length - 1; i++) {
    const fromTrack = sequence[i];
    const toTrack = sequence[i + 1];
    
    const compat = getCompatibility(graph, fromTrack.trackId, toTrack.trackId);
    if (!compat) continue;
    
    const fromRole = roles.get(fromTrack.trackId) ?? 'full-mix';
    const toRole = roles.get(toTrack.trackId) ?? 'full-mix';
    
    // Get cue points
    const fromExitCue = getBestCuePoint(fromTrack, 'mix-out') ?? { position: fromTrack.durationSeconds * 0.8, confidence: 0.5 };
    const toEntryCue = getBestCuePoint(toTrack, 'mix-in') ?? { position: 0, confidence: 0.5 };
    
    // Determine if we should use stems
    const useStems = fromRole !== 'full-mix' && toRole !== 'full-mix'
      && policy.stemUsagePolicy.useStemsWhenAvailable
      && (fromTrack.hasStems || toTrack.hasStems);
    
    const transition: PlannedTransition = {
      fromTrackId: fromTrack.trackId,
      toTrackId: toTrack.trackId,
      fromRole,
      toRole,
      fromExitCueSeconds: fromExitCue.position,
      toEntryCueSeconds: toEntryCue.position,
      overlapDurationSeconds: compat.suggestedOverlapDuration,
      transitionStyle: compat.suggestedTransitionStyle,
      tempoRampStrategy: 'linear',
      targetBpm: toTrack.bpm,
      useStems,
      stemConfig: useStems ? {
        vocalTrackId: fromRole === 'lead-vocal' ? fromTrack.trackId : toTrack.trackId,
        instrumentalTrackId: fromRole === 'lead-instrumental' ? fromTrack.trackId : toTrack.trackId,
      } : undefined,
      compatibilityScore: compat.scores['full-mix_to_full-mix'],
      confidence: Math.min(fromExitCue.confidence, toEntryCue.confidence),
    };
    
    transitions.push(transition);
    
    decisions.push({
      decisionType: 'transition_style',
      trackIds: [fromTrack.trackId, toTrack.trackId],
      chosen: compat.suggestedTransitionStyle,
      rejected: [],
      rationale: `Compatibility score: ${transition.compatibilityScore.toFixed(3)}, roles: ${fromRole} -> ${toRole}`,
    });
  }
  
  return { transitions, transitionDecisions: decisions };
}

/**
 * Validate the plan against policies
 */
function validatePlan(
  graph: PlanningGraph,
  sequence: TrackPlanningSummary[],
  transitions: PlannedTransition[],
  policy: PlanningPolicy
): { valid: boolean; warnings: PlannerTrace['warnings'] } {
  const warnings: PlannerTrace['warnings'] = [];
  
  // Check energy arc
  const trackEnergies = sequence.map((track, index) => ({
    progressPercent: (index / (sequence.length - 1)) * 100,
    energy: track.energyProfile.averageEnergy,
  }));
  
  const energyValidation = validateEnergyArc(trackEnergies, policy);
  if (!energyValidation.valid) {
    warnings.push({
      type: 'energy_arc_deviation',
      message: `Energy arc deviations: ${energyValidation.violations.join(', ')}`,
      severity: 'medium',
    });
  }
  
  // Check for vocal collisions
  const vocalCollisions = transitions.filter(t => 
    (t.fromRole === 'lead-vocal' && t.toRole === 'lead-vocal') ||
    (t.compatibilityScore < 0.3)
  );
  
  if (vocalCollisions.length > 0) {
    warnings.push({
      type: 'low_compatibility_transitions',
      message: `${vocalCollisions.length} transitions have low compatibility scores`,
      severity: 'high',
      affectedTrackIds: vocalCollisions.flatMap(t => [t.fromTrackId, t.toTrackId]),
    });
  }
  
  return { valid: warnings.length === 0, warnings };
}

/**
 * Build the final sequence plan object
 */
function buildSequencePlan(
  planId: string,
  sequence: TrackPlanningSummary[],
  roles: Map<string, TrackRole>,
  transitions: PlannedTransition[],
  graph: PlanningGraph
): SequencePlan {
  let currentTime = 0;
  const sequenceItems = sequence.map((track, index) => {
    const role = roles.get(track.trackId) ?? 'full-mix';
    const transition = index > 0 ? transitions[index - 1] : null;
    
    const entryCue = index === 0 
      ? 0 
      : (transition?.toEntryCueSeconds ?? 0);
    
    const exitCue = index === sequence.length - 1
      ? track.durationSeconds
      : (transitions[index]?.fromExitCueSeconds ?? track.durationSeconds * 0.8);
    
    const item = {
      trackId: track.trackId,
      role,
      startTimeSeconds: currentTime,
      endTimeSeconds: currentTime + (exitCue - entryCue),
      entryCueUsed: entryCue,
      exitCueUsed: exitCue,
    };
    
    // Advance time for next track
    if (index < sequence.length - 1 && transitions[index]) {
      const trans = transitions[index];
      currentTime += trans.fromExitCueSeconds - entryCue;
      // Subtract overlap
      currentTime -= trans.overlapDurationSeconds;
    }
    
    return item;
  });
  
  // Calculate total duration
  const totalDuration = sequenceItems[sequenceItems.length - 1]?.endTimeSeconds ?? 0;
  
  // Calculate quality scores
  const avgTempoCompat = transitions.length > 0
    ? transitions.reduce((acc, t) => acc + t.compatibilityScore, 0) / transitions.length
    : 0;
  
  const avgHarmonicCompat = transitions.length > 0
    ? transitions.reduce((acc, t) => {
        const compat = getCompatibility(graph, t.fromTrackId, t.toTrackId);
        return acc + (compat?.harmonicCompatibility ?? 0);
      }, 0) / transitions.length
    : 0;
  
  const vocalClashRisk = transitions.filter(t => 
    t.fromRole === 'lead-vocal' && t.toRole === 'lead-vocal'
  ).length / Math.max(1, transitions.length);
  
  return {
    planId,
    createdAt: new Date().toISOString(),
    trackIds: sequence.map(t => t.trackId),
    sequence: sequenceItems,
    transitions,
    totalDurationSeconds: totalDuration,
    estimatedEnergyFlow: sequenceItems.map((item, index) => ({
      timeSeconds: item.startTimeSeconds,
      energyLevel: sequence[index].energyProfile.averageEnergy,
    })),
    qualityScores: {
      overallScore: avgTempoCompat,
      tempoCompatibility: avgTempoCompat,
      harmonicFlow: avgHarmonicCompat,
      energyFlow: 0.7, // Placeholder
      transitionQuality: avgTempoCompat,
      vocalClashRisk,
    },
  };
}
