import Redis from 'ioredis';

let sharedConnection: Redis | null = null;

export function getRedisConnectionOptions(): Record<string, unknown> {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379', 10),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: parsed.pathname ? parseInt(parsed.pathname.slice(1), 10) || 0 : 0,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}

export function getRedisConnection(): Redis {
  if (!sharedConnection) {
    const opts = getRedisConnectionOptions();
    sharedConnection = new Redis({
      host: opts.host as string,
      port: opts.port as number,
      username: opts.username as string | undefined,
      password: opts.password as string | undefined,
      db: opts.db as number,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    });
  }
  return sharedConnection;
}

export async function cleanupRedisConnection(): Promise<void> {
  if (sharedConnection) {
    const conn = sharedConnection;
    sharedConnection = null;
    await conn.quit();
  }
}

export async function checkRedisHealth(): Promise<{
  status: 'up' | 'down';
  latencyMs?: number;
  error?: string;
}> {
  try {
    const conn = getRedisConnection();
    const start = Date.now();
    await conn.ping();
    return { status: 'up', latencyMs: Date.now() - start };
  } catch (error) {
    return {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown Redis error',
    };
  }
}
