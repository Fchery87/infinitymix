import { createHash } from 'node:crypto';

export type AutomationOperationKind = 'analysis' | 'stems' | 'mix' | 'preview';

export type AutomationRecoveryPolicy = {
  operation: AutomationOperationKind;
  execution: 'durable-job' | 'sync-request';
  sideEffects: 'persistent-write' | 'none';
  idempotencyScope: string;
  recovery: string[];
};

const RECOVERY_POLICIES: Record<AutomationOperationKind, AutomationRecoveryPolicy> = {
  analysis: {
    operation: 'analysis',
    execution: 'durable-job',
    sideEffects: 'persistent-write',
    idempotencyScope: 'track',
    recovery: [
      'Re-enqueue by track id if the job fails or the lease expires.',
      'Prefer storage-backed replay when in-memory buffers are unavailable.',
      'Overwrite only the authoritative analysis fields for the same track.',
    ],
  },
  stems: {
    operation: 'stems',
    execution: 'durable-job',
    sideEffects: 'persistent-write',
    idempotencyScope: 'track-and-quality',
    recovery: [
      'Retry by track id and requested quality.',
      'Replace incomplete stem records for the same track/stem type.',
      'Leave completed stems readable across retries and restarts.',
    ],
  },
  mix: {
    operation: 'mix',
    execution: 'durable-job',
    sideEffects: 'persistent-write',
    idempotencyScope: 'mashup',
    recovery: [
      'Retry by mashup id and render profile.',
      'Treat master/playback asset writes as replaceable outputs for the same mashup.',
      'Use job lease ownership to avoid stale workers completing reclaimed jobs.',
    ],
  },
  preview: {
    operation: 'preview',
    execution: 'sync-request',
    sideEffects: 'none',
    idempotencyScope: 'user-and-request-shape',
    recovery: [
      'Preview requests are stateless and can be retried safely by the client.',
      'No persistent state is committed from preview generation.',
      'The preview idempotency key is deterministic for the request payload.',
    ],
  },
};

export function getAutomationRecoveryPolicy(operation: AutomationOperationKind) {
  return RECOVERY_POLICIES[operation];
}

export function buildPreviewGenerationIdempotencyKey(args: {
  userId: string;
  trackIds: string[];
  durationSeconds: number;
  mixMode: string;
}) {
  const hash = createHash('sha256');
  hash.update(
    JSON.stringify({
      userId: args.userId,
      trackIds: [...args.trackIds].sort(),
      durationSeconds: args.durationSeconds,
      mixMode: args.mixMode,
    })
  );
  return `preview:${hash.digest('hex').slice(0, 24)}`;
}
