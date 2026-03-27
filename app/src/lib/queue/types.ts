export type {
  AutomationJobKind,
  AutomationJobExecutionStatus,
  AutomationQueueStats,
  AutomationEnqueueReceipt,
  QueueDriver,
  AnalysisJobPayload,
  StemsJobPayload,
  MixJobPayload,
  AutomationJobPayload,
} from '@/lib/runtime/contracts';

export type JobHandler = (payload: unknown) => Promise<void>;

export interface QueueDriverInstance {
  on(type: string, handler: JobHandler): void;
  enqueue(payload: unknown): Promise<import('@/lib/runtime/contracts').AutomationEnqueueReceipt>;
  getStats(): import('@/lib/runtime/contracts').AutomationQueueStats | Promise<import('@/lib/runtime/contracts').AutomationQueueStats>;
  cleanup?(): Promise<void>;
}
