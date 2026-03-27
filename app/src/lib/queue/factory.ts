import { BullMQQueueDriver } from './bullmq-driver';
import { DurableQueueDriverAdapter } from './durable-driver';
import type { QueueDriverInstance } from './types';

export function createQueueDriver(): { driver: QueueDriverInstance; name: 'bullmq' | 'durable' } {
  const redisUrl = process.env.REDIS_URL?.trim();

  if (redisUrl) {
    try {
      const driver = new BullMQQueueDriver();
      return { driver, name: 'bullmq' };
    } catch (error) {
      console.error('[queue] BullMQ initialization failed, falling back to durable driver:', error);
    }
  }

  return { driver: new DurableQueueDriverAdapter(), name: 'durable' };
}
