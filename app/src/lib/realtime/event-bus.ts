import { getRedisConnection } from '@/lib/queue/redis';
import { log } from '@/lib/logger';

type EventHandler = (data: unknown) => void;

export class RedisEventBus {
  private subscriber: any = null;
  private handlers = new Map<string, Set<EventHandler>>();

  async subscribe(channel: string, handler: EventHandler): Promise<void> {
    if (!this.subscriber) {
      const redis = getRedisConnection();
      this.subscriber = redis.duplicate();
      this.subscriber.connect();
      this.subscriber.on('message', (ch: string, message: string) => {
        const handlers = this.handlers.get(ch);
        if (handlers) {
          try {
            const data = JSON.parse(message);
            for (const h of handlers) h(data);
          } catch {
            log('warn', 'realtime.parseError', { channel: ch });
          }
        }
      });
    }

    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set());
      await this.subscriber.subscribe(channel);
    }
    this.handlers.get(channel)!.add(handler);
  }

  async unsubscribe(channel: string, handler: EventHandler): Promise<void> {
    const handlers = this.handlers.get(channel);
    if (!handlers) return;
    handlers.delete(handler);
    if (handlers.size === 0) {
      this.handlers.delete(channel);
      await this.subscriber?.unsubscribe(channel);
    }
  }

  async publish(channel: string, data: unknown): Promise<void> {
    const redis = getRedisConnection() as any;
    await redis.publish(channel, JSON.stringify(data));
  }

  async cleanup(): Promise<void> {
    if (this.subscriber) {
      await this.subscriber.quit();
      this.subscriber = null;
    }
    this.handlers.clear();
  }
}

let eventBusInstance: RedisEventBus | null = null;

export function getEventBus(): RedisEventBus {
  if (!eventBusInstance) {
    eventBusInstance = new RedisEventBus();
  }
  return eventBusInstance;
}
