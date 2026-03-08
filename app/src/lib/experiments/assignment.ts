/**
 * Variant Assignment Service
 * 
 * Assigns users to experiment variants using stable hashing.
 * Ensures users consistently get the same variant across sessions.
 */

import { createHash } from 'crypto';
import type { 
  Experiment, 
  ExperimentVariant, 
  ExperimentAssignment,
  AssignmentResult,
  ExperimentDomain 
} from './types';

// In-memory store for experiments (in production, this would be cached from DB)
const experimentsCache = new Map<string, Experiment>();
const assignmentsCache = new Map<string, ExperimentAssignment>(); // key: `${experimentId}:${userId}`

/**
 * Salt for hashing (should be consistent across deployments)
 */
const ASSIGNMENT_SALT = process.env.EXPERIMENT_ASSIGNMENT_SALT || 'infinitymix-experiments-2026';

/**
 * Assign a user to a variant for an experiment
 * Uses stable hashing so the same user always gets the same variant
 */
export function assignVariant(
  experiment: Experiment,
  userId: string,
  context?: { userAgent?: string; ipAddress?: string; sessionId?: string }
): AssignmentResult {
  // Check if user already has an assignment
  const cacheKey = `${experiment.id}:${userId}`;
  const existingAssignment = assignmentsCache.get(cacheKey);
  
  if (existingAssignment) {
    const variant = experiment.variants.find(v => v.id === existingAssignment.variantId);
    if (variant) {
      return {
        experimentId: experiment.id,
        variantId: variant.id,
        variantName: variant.name,
        codePath: variant.codePath,
        config: variant.configOverrides,
        isFirstAssignment: false,
      };
    }
  }
  
  // Determine if user should be in experiment at all
  const inExperiment = shouldUserBeInExperiment(experiment, userId);
  if (!inExperiment) {
    // Return control variant
    const controlVariant = experiment.variants.find(v => v.isControl) || experiment.variants[0];
    return {
      experimentId: experiment.id,
      variantId: controlVariant.id,
      variantName: controlVariant.name,
      codePath: controlVariant.codePath,
      config: controlVariant.configOverrides,
      isFirstAssignment: true,
    };
  }
  
  // Assign to variant based on traffic percentages
  const variant = selectVariantByTraffic(experiment.variants, userId);
  
  // Create assignment record
  const assignment: ExperimentAssignment = {
    id: generateId(),
    experimentId: experiment.id,
    userId,
    variantId: variant.id,
    assignedAt: new Date().toISOString(),
    context: {
      userAgent: context?.userAgent,
      ipHash: context?.ipAddress ? hashString(context.ipAddress) : undefined,
      sessionId: context?.sessionId,
      timestamp: new Date().toISOString(),
    },
  };
  
  // Cache assignment
  assignmentsCache.set(cacheKey, assignment);
  
  // Persist to database (async, don't wait)
  persistAssignment(assignment).catch(console.error);
  
  return {
    experimentId: experiment.id,
    variantId: variant.id,
    variantName: variant.name,
    codePath: variant.codePath,
    config: variant.configOverrides,
    isFirstAssignment: true,
  };
}

/**
 * Get assignment for a user (creating if necessary)
 */
export async function getOrCreateAssignment(
  experimentId: string,
  userId: string,
  context?: { userAgent?: string; ipAddress?: string; sessionId?: string }
): Promise<AssignmentResult | null> {
  const experiment = experimentsCache.get(experimentId);
  if (!experiment) {
    return null;
  }
  
  if (experiment.status !== 'running') {
    // Return control variant if experiment not running
    const controlVariant = experiment.variants.find(v => v.isControl);
    if (controlVariant) {
      return {
        experimentId: experiment.id,
        variantId: controlVariant.id,
        variantName: controlVariant.name,
        codePath: controlVariant.codePath,
        config: controlVariant.configOverrides,
        isFirstAssignment: false,
      };
    }
    return null;
  }
  
  return assignVariant(experiment, userId, context);
}

/**
 * Check if user should be in experiment (based on overall traffic allocation)
 */
function shouldUserBeInExperiment(experiment: Experiment, userId: string): boolean {
  // Hash user ID with experiment name to get stable 0-1 value
  const hash = hashString(`${userId}:${experiment.name}:${ASSIGNMENT_SALT}`);
  const value = parseInt(hash.slice(0, 8), 16) / 0xffffffff;
  
  return value < (experiment.trafficAllocation / 100);
}

/**
 * Select variant based on traffic percentages using stable hashing
 */
function selectVariantByTraffic(variants: ExperimentVariant[], userId: string): ExperimentVariant {
  // Sort variants by ID for deterministic ordering
  const sortedVariants = [...variants].sort((a, b) => a.id.localeCompare(b.id));
  
  // Hash user ID to get stable 0-100 value
  const hash = hashString(`${userId}:variant-selection:${ASSIGNMENT_SALT}`);
  const value = (parseInt(hash.slice(0, 8), 16) / 0xffffffff) * 100;
  
  // Select variant based on cumulative traffic percentage
  let cumulative = 0;
  for (const variant of sortedVariants) {
    cumulative += variant.trafficPercentage;
    if (value <= cumulative) {
      return variant;
    }
  }
  
  // Fallback to last variant (shouldn't happen with proper percentages)
  return sortedVariants[sortedVariants.length - 1];
}

/**
 * Register an experiment in the cache
 */
export function registerExperiment(experiment: Experiment): void {
  experimentsCache.set(experiment.id, experiment);
}

/**
 * Get experiment by ID
 */
export function getExperiment(experimentId: string): Experiment | undefined {
  return experimentsCache.get(experimentId);
}

/**
 * Get all active experiments for a domain
 */
export function getActiveExperimentsForDomain(
  domain: ExperimentDomain
): Experiment[] {
  return Array.from(experimentsCache.values()).filter(
    e => e.domain === domain && e.status === 'running'
  );
}

/**
 * Get variant assignment for a user (checking all experiments in a domain)
 * Returns the first matching assignment
 */
export async function getVariantForDomain(
  domain: ExperimentDomain,
  userId: string,
  context?: { userAgent?: string; ipAddress?: string; sessionId?: string }
): Promise<AssignmentResult | null> {
  const experiments = getActiveExperimentsForDomain(domain);
  
  if (experiments.length === 0) {
    return null;
  }
  
  // For now, return assignment for the first active experiment
  // In production, you might have multiple experiments and need prioritization logic
  const experiment = experiments[0];
  return getOrCreateAssignment(experiment.id, userId, context);
}

/**
 * Check if a user is in a specific variant
 */
export function isUserInVariant(
  experimentId: string,
  userId: string,
  variantName: string
): boolean {
  const cacheKey = `${experimentId}:${userId}`;
  const assignment = assignmentsCache.get(cacheKey);
  
  if (!assignment) {
    return false;
  }
  
  const experiment = experimentsCache.get(experimentId);
  if (!experiment) {
    return false;
  }
  
  const variant = experiment.variants.find(v => v.id === assignment.variantId);
  return variant?.name === variantName;
}

/**
 * Hash a string using SHA-256, return first 16 chars
 */
function hashString(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 16);
}

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Persist assignment to database (placeholder implementation)
 */
async function persistAssignment(assignment: ExperimentAssignment): Promise<void> {
  // In production, this would write to the database
  // For now, just log it
  console.log('Persisting assignment:', {
    experimentId: assignment.experimentId,
    userId: assignment.userId,
    variantId: assignment.variantId,
  });
}
