/**
 * Experiment Telemetry Service
 * 
 * Captures events and feedback for experiment analysis.
 * Links user actions to variant assignments.
 */

import type {
  TelemetryEvent,
  TelemetryEventType,
  UserFeedback,
  ExperimentAssignment,
} from './types';

// In-memory buffer for telemetry (flush to DB periodically)
const telemetryBuffer: TelemetryEvent[] = [];
const feedbackBuffer: UserFeedback[] = [];

/**
 * Capture a telemetry event
 */
export function captureEvent(
  experimentId: string,
  variantId: string,
  userId: string,
  eventType: TelemetryEventType,
  eventData: Record<string, unknown>,
  metadata?: { userAgent?: string; requestId?: string }
): void {
  const event: TelemetryEvent = {
    id: generateId(),
    experimentId,
    variantId,
    userId,
    eventType,
    eventData,
    metadata: {
      userAgent: metadata?.userAgent || 'unknown',
      timestamp: new Date().toISOString(),
      requestId: metadata?.requestId,
    },
  };
  
  telemetryBuffer.push(event);
  
  // Flush if buffer is getting large
  if (telemetryBuffer.length >= 100) {
    flushTelemetry().catch(console.error);
  }
}

/**
 * Capture user feedback
 */
export function captureFeedback(
  experimentId: string,
  variantId: string,
  userId: string,
  feedback: Omit<UserFeedback, 'id' | 'experimentId' | 'variantId' | 'userId' | 'createdAt'>
): void {
  const feedbackRecord: UserFeedback = {
    id: generateId(),
    experimentId,
    variantId,
    userId,
    ...feedback,
    createdAt: new Date().toISOString(),
  };
  
  feedbackBuffer.push(feedbackRecord);
  
  // Also capture as telemetry event
  captureEvent(
    experimentId,
    variantId,
    userId,
    'user_feedback',
    {
      rating: feedback.rating,
      wouldRecommend: feedback.wouldRecommend,
      hasText: !!feedback.feedbackText,
    }
  );
  
  // Flush if buffer is getting large
  if (feedbackBuffer.length >= 50) {
    flushFeedback().catch(console.error);
  }
}

/**
 * Record feature invocation (start of operation)
 */
export function recordFeatureInvoked(
  experimentId: string,
  variantId: string,
  userId: string,
  feature: string,
  params: Record<string, unknown>,
  metadata?: { userAgent?: string; requestId?: string }
): string {
  const eventId = generateId();
  
  captureEvent(
    experimentId,
    variantId,
    userId,
    'feature_invoked',
    {
      eventId,
      feature,
      params,
      timestamp: Date.now(),
    },
    metadata
  );
  
  return eventId;
}

/**
 * Record feature completion
 */
export function recordFeatureCompleted(
  experimentId: string,
  variantId: string,
  userId: string,
  invokeEventId: string,
  result: Record<string, unknown>,
  durationMs: number
): void {
  captureEvent(
    experimentId,
    variantId,
    userId,
    'feature_completed',
    {
      invokeEventId,
      result,
      durationMs,
      timestamp: Date.now(),
    }
  );
}

/**
 * Record feature failure
 */
export function recordFeatureFailed(
  experimentId: string,
  variantId: string,
  userId: string,
  invokeEventId: string,
  error: Error,
  durationMs: number
): void {
  captureEvent(
    experimentId,
    variantId,
    userId,
    'feature_failed',
    {
      invokeEventId,
      error: {
        message: error.message,
        name: error.name,
        stack: error.stack,
      },
      durationMs,
      timestamp: Date.now(),
    }
  );
}

/**
 * Record QA result
 */
export function recordQAResult(
  experimentId: string,
  variantId: string,
  userId: string,
  mashupId: string,
  qaResult: {
    passed: boolean;
    failedChecks: string[];
    score?: number;
  }
): void {
  captureEvent(
    experimentId,
    variantId,
    userId,
    'qa_result',
    {
      mashupId,
      passed: qaResult.passed,
      failedChecks: qaResult.failedChecks,
      score: qaResult.score,
    }
  );
}

/**
 * Record export/download
 */
export function recordExportCompleted(
  experimentId: string,
  variantId: string,
  userId: string,
  mashupId: string,
  format: string
): void {
  captureEvent(
    experimentId,
    variantId,
    userId,
    'export_completed',
    {
      mashupId,
      format,
      timestamp: Date.now(),
    }
  );
}

/**
 * Record regeneration request
 */
export function recordRegenerationRequested(
  experimentId: string,
  variantId: string,
  userId: string,
  mashupId: string,
  reason?: string
): void {
  captureEvent(
    experimentId,
    variantId,
    userId,
    'regeneration_requested',
    {
      mashupId,
      reason,
      timestamp: Date.now(),
    }
  );
}

/**
 * Flush telemetry buffer to database
 */
export async function flushTelemetry(): Promise<void> {
  if (telemetryBuffer.length === 0) return;
  
  const events = [...telemetryBuffer];
  telemetryBuffer.length = 0; // Clear buffer
  
  // In production, write to database
  console.log(`Flushing ${events.length} telemetry events`);
  
  try {
    // Placeholder: would insert into database
    // await db.insert(experimentTelemetry).values(events);
  } catch (error) {
    console.error('Failed to flush telemetry:', error);
    // Re-add to buffer for retry
    telemetryBuffer.push(...events);
  }
}

/**
 * Flush feedback buffer to database
 */
export async function flushFeedback(): Promise<void> {
  if (feedbackBuffer.length === 0) return;
  
  const feedbacks = [...feedbackBuffer];
  feedbackBuffer.length = 0; // Clear buffer
  
  // In production, write to database
  console.log(`Flushing ${feedbacks.length} feedback records`);
  
  try {
    // Placeholder: would insert into database
    // await db.insert(userFeedback).values(feedbacks);
  } catch (error) {
    console.error('Failed to flush feedback:', error);
    // Re-add to buffer for retry
    feedbackBuffer.push(...feedbacks);
  }
}

/**
 * Get metrics for a variant
 */
export async function getVariantMetrics(
  experimentId: string,
  variantId: string,
  startDate?: Date,
  endDate?: Date
): Promise<{
  eventCount: number;
  successCount: number;
  failureCount: number;
  averageDurationMs: number;
  uniqueUsers: number;
}> {
  // Filter events for this variant
  const events = telemetryBuffer.filter(
    e => e.experimentId === experimentId && e.variantId === variantId
  );
  
  // Apply date filter if provided
  const filteredEvents = events.filter(e => {
    const eventDate = new Date(e.metadata.timestamp);
    if (startDate && eventDate < startDate) return false;
    if (endDate && eventDate > endDate) return false;
    return true;
  });
  
  const completedEvents = filteredEvents.filter(e => e.eventType === 'feature_completed');
  const failedEvents = filteredEvents.filter(e => e.eventType === 'feature_failed');
  
  const durations = completedEvents
    .map(e => e.eventData.durationMs as number)
    .filter(d => typeof d === 'number');
  
  const uniqueUsers = new Set(filteredEvents.map(e => e.userId)).size;
  
  return {
    eventCount: filteredEvents.length,
    successCount: completedEvents.length,
    failureCount: failedEvents.length,
    averageDurationMs: durations.length > 0 
      ? durations.reduce((a, b) => a + b, 0) / durations.length 
      : 0,
    uniqueUsers,
  };
}

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
