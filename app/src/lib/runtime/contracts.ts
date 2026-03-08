import type { BrowserAnalysisHint } from '@/lib/audio/types/analysis';
import type { AutoDjConfig, AutoDjPlan } from '@/lib/audio/auto-dj-service';

export const AUTHORITATIVE_RUNTIME = 'app' as const;
export const LEGACY_RUNTIME_MODE = 'legacy-non-authoritative' as const;

export type RuntimeAuthority = typeof AUTHORITATIVE_RUNTIME;
export type LegacyRuntimeMode = typeof LEGACY_RUNTIME_MODE;

export type AutomationJobKind = 'analysis' | 'stems' | 'mix';
export type AutomationJobExecutionStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export type AnalysisResourceStatus = 'pending' | 'analyzing' | 'completed' | 'failed';
export type StemResourceStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type MashupResourceStatus = 'pending' | 'generating' | 'completed' | 'failed';

export type QueueDriver = 'in-memory' | 'worker-thread' | 'durable';

export type AutomationJobOwner = {
  runtime: RuntimeAuthority;
  legacyMode: LegacyRuntimeMode;
};

export const DEFAULT_AUTOMATION_JOB_OWNER: AutomationJobOwner = {
  runtime: AUTHORITATIVE_RUNTIME,
  legacyMode: LEGACY_RUNTIME_MODE,
};

export type AutomationJobResourceRef =
  | { kind: 'track'; id: string }
  | { kind: 'mashup'; id: string };

export type AnalysisJobPayload = {
  type: 'analysis';
  trackId: string;
  buffer?: Buffer;
  storageUrl?: string;
  mimeType: string;
  fileName: string;
  browserAnalysisHint?: BrowserAnalysisHint;
};

export type StemsJobPayload = {
  type: 'stems';
  trackId: string;
  quality?: 'draft' | 'hifi';
};

export type MixJobPayload = {
  type: 'mix';
  mashupId: string;
  inputTrackIds: string[];
  durationSeconds: number;
  renderProfile?: 'standard' | 'auto_dj';
  mixMode?: AutoDjConfig['mixMode'];
  autoDjConfig?: Omit<AutoDjConfig, 'trackIds' | 'targetDurationSeconds'> & {
    plan?: AutoDjPlan;
  };
};

export type AutomationJobPayload =
  | AnalysisJobPayload
  | StemsJobPayload
  | MixJobPayload;

export type AutomationJob = AutomationJobPayload & {
  owner: AutomationJobOwner;
  resource: AutomationJobResourceRef;
  executionStatus: AutomationJobExecutionStatus;
  retryable: boolean;
  idempotencyKey: string;
  createdAt: number;
};

export type AutomationWorkerJob = {
  id: string;
  type: AutomationJobKind;
  input: {
    buffer?: Buffer;
    filePath?: string;
    config: Record<string, unknown>;
  };
  priority: number;
  createdAt: number;
  owner: AutomationJobOwner;
};

export type AutomationWorkerResult = {
  jobId: string;
  success: boolean;
  data?: unknown;
  error?: string;
  duration: number;
};

export type AutomationWorkerProgress = {
  jobId: string;
  progress: number;
  stage: string;
  message?: string;
};

export type AutomationQueueStats = {
  driver: QueueDriver;
  pendingJobs: number;
  runningJobs: number;
  concurrency: number;
};

export type AutomationEnqueueReceipt = {
  driver: QueueDriver;
  status: 'queued';
  resource: AutomationJobResourceRef;
  jobId: string | null;
  idempotencyKey: string;
};

export function buildAutomationJobResourceRef(
  payload: AutomationJobPayload
): AutomationJobResourceRef {
  switch (payload.type) {
    case 'analysis':
    case 'stems':
      return { kind: 'track', id: payload.trackId };
    case 'mix':
      return { kind: 'mashup', id: payload.mashupId };
  }
}

export function buildAutomationJobIdempotencyKey(
  payload: AutomationJobPayload
): string {
  switch (payload.type) {
    case 'analysis':
      return `analysis:${payload.trackId}`;
    case 'stems':
      return `stems:${payload.trackId}:${payload.quality ?? 'draft'}`;
    case 'mix':
      return `mix:${payload.mashupId}:${payload.renderProfile ?? 'standard'}:${payload.durationSeconds}:${payload.mixMode ?? 'standard'}`;
  }
}

export function createAutomationJob(payload: AutomationJobPayload): AutomationJob {
  return {
    ...payload,
    owner: DEFAULT_AUTOMATION_JOB_OWNER,
    resource: buildAutomationJobResourceRef(payload),
    executionStatus: 'queued',
    retryable: true,
    idempotencyKey: buildAutomationJobIdempotencyKey(payload),
    createdAt: Date.now(),
  };
}

export function createAutomationWorkerJob(
  args: Omit<AutomationWorkerJob, 'id' | 'createdAt' | 'owner'>
): AutomationWorkerJob {
  return {
    ...args,
    id: `${args.type}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: Date.now(),
    owner: DEFAULT_AUTOMATION_JOB_OWNER,
  };
}
