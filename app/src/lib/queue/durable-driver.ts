import { DurableAutomationQueueDriver } from '@/lib/runtime/durable-queue-driver';
import type {
  AutomationEnqueueReceipt,
  AutomationJobKind,
  AutomationQueueStats,
  AutomationJobPayload,
} from '@/lib/runtime/contracts';
import type { JobHandler, QueueDriverInstance } from './types';

export class DurableQueueDriverAdapter implements QueueDriverInstance {
  private driver: DurableAutomationQueueDriver;

  constructor(concurrency = 2) {
    this.driver = new DurableAutomationQueueDriver(concurrency);
  }

  on(kind: AutomationJobKind, handler: JobHandler): void {
    this.driver.on(kind, handler);
  }

  async enqueue(payload: AutomationJobPayload): Promise<AutomationEnqueueReceipt> {
    return this.driver.enqueue(payload);
  }

  getStats(): AutomationQueueStats {
    return this.driver.getStats();
  }
}
