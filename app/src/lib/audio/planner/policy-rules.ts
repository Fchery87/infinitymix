/**
 * Planning Policy Rules
 * 
 * Default policies and rules for sequence planning,
 * including event archetypes and safety constraints.
 */

import type { PlanningPolicy, EventArchetype } from '@/lib/audio/types/planner';

/**
 * Get the default planning policy
 */
export function getDefaultPolicy(): PlanningPolicy {
  return {
    energyArcPolicy: {
      type: 'warmup-journey',
      checkpoints: [
        { progressPercent: 0, targetEnergyLevel: 0.3, tolerance: 0.1 },
        { progressPercent: 25, targetEnergyLevel: 0.4, tolerance: 0.15 },
        { progressPercent: 50, targetEnergyLevel: 0.6, tolerance: 0.15 },
        { progressPercent: 75, targetEnergyLevel: 0.75, tolerance: 0.1 },
        { progressPercent: 100, targetEnergyLevel: 0.85, tolerance: 0.1 },
      ],
    },
    
    stemUsagePolicy: {
      useStemsWhenAvailable: true,
      preferVocalOverInstrumental: true,
      maxStemQualityPenalty: 0.2,
    },
    
    transitionPolicy: {
      defaultStyle: 'phrase-snap',
      phraseAligned: true,
      minOverlapBeats: 8,
      maxOverlapBeats: 32,
    },
    
    safetyRules: {
      rejectVocalCollisions: true,
      maxTempoStretchPercent: 8,
      minHarmonicCompatibility: 0.8,
      minCuePointConfidence: 0.5,
    },
  };
}

/**
 * Get policy for a specific event archetype
 */
export function getPolicyForArchetype(archetype: EventArchetype): PlanningPolicy {
  const base = getDefaultPolicy();
  
  switch (archetype) {
    case 'party-peak':
      return {
        ...base,
        energyArcPolicy: {
          type: 'party-peak',
          checkpoints: [
            { progressPercent: 0, targetEnergyLevel: 0.7, tolerance: 0.1 },
            { progressPercent: 50, targetEnergyLevel: 0.8, tolerance: 0.1 },
            { progressPercent: 100, targetEnergyLevel: 0.9, tolerance: 0.1 },
          ],
        },
        transitionPolicy: {
          ...base.transitionPolicy,
          defaultStyle: 'energy-build',
        },
      };
      
    case 'warmup-journey':
      return base; // Default is already warmup
      
    case 'peak-valley':
      return {
        ...base,
        energyArcPolicy: {
          type: 'peak-valley',
          checkpoints: [
            { progressPercent: 0, targetEnergyLevel: 0.4, tolerance: 0.1 },
            { progressPercent: 25, targetEnergyLevel: 0.7, tolerance: 0.15 },
            { progressPercent: 50, targetEnergyLevel: 0.4, tolerance: 0.1 },
            { progressPercent: 75, targetEnergyLevel: 0.75, tolerance: 0.15 },
            { progressPercent: 100, targetEnergyLevel: 0.6, tolerance: 0.1 },
          ],
        },
      };
      
    case 'chill-vibe':
      return {
        ...base,
        energyArcPolicy: {
          type: 'chill-vibe',
          checkpoints: [
            { progressPercent: 0, targetEnergyLevel: 0.3, tolerance: 0.1 },
            { progressPercent: 50, targetEnergyLevel: 0.4, tolerance: 0.15 },
            { progressPercent: 100, targetEnergyLevel: 0.35, tolerance: 0.1 },
          ],
        },
        safetyRules: {
          ...base.safetyRules,
          maxTempoStretchPercent: 12, // More relaxed
        },
      };
      
    case 'sunrise-set':
      return {
        ...base,
        energyArcPolicy: {
          type: 'sunrise-set',
          checkpoints: [
            { progressPercent: 0, targetEnergyLevel: 0.25, tolerance: 0.1 },
            { progressPercent: 33, targetEnergyLevel: 0.5, tolerance: 0.15 },
            { progressPercent: 66, targetEnergyLevel: 0.8, tolerance: 0.1 },
            { progressPercent: 100, targetEnergyLevel: 0.75, tolerance: 0.1 },
          ],
        },
      };
      
    default:
      return base;
  }
}

/**
 * Validate if a sequence adheres to the energy arc policy
 */
export function validateEnergyArc(
  trackEnergies: Array<{ progressPercent: number; energy: number }>,
  policy: PlanningPolicy
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];
  
  for (const checkpoint of policy.energyArcPolicy.checkpoints) {
    // Find the closest track energy point to this checkpoint
    const closest = trackEnergies.reduce((best, current) =>
      Math.abs(current.progressPercent - checkpoint.progressPercent) <
      Math.abs(best.progressPercent - checkpoint.progressPercent)
        ? current
        : best
    );
    
    const deviation = Math.abs(closest.energy - checkpoint.targetEnergyLevel);
    if (deviation > checkpoint.tolerance) {
      violations.push(
        `Energy at ${checkpoint.progressPercent}% is ${closest.energy.toFixed(2)}, ` +
        `expected ${checkpoint.targetEnergyLevel} ± ${checkpoint.tolerance}`
      );
    }
  }
  
  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Check if a transition is allowed by safety rules
 */
export function isTransitionAllowed(
  compatibility: { harmonicClashSeverity: number; vocalCollisionRisk: number },
  policy: PlanningPolicy
): { allowed: boolean; reason?: string } {
  const { safetyRules } = policy;
  
  if (safetyRules.rejectVocalCollisions && compatibility.vocalCollisionRisk > 0.7) {
    return {
      allowed: false,
      reason: 'Vocal collision risk too high',
    };
  }
  
  if (compatibility.harmonicClashSeverity > 1 - safetyRules.minHarmonicCompatibility) {
    return {
      allowed: false,
      reason: 'Harmonic clash exceeds threshold',
    };
  }
  
  return { allowed: true };
}
