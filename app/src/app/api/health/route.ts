import { NextResponse } from 'next/server';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { checkRedisHealth } from '@/lib/queue/redis';

export async function GET() {
  const startTime = Date.now();
  const status = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '0.1.0',
    environment: process.env.NODE_ENV || 'development',
    checks: {} as Record<string, unknown>,
  };

  try {
    // Database health check
    if (process.env.DATABASE_URL) {
      try {
        const client = postgres(process.env.DATABASE_URL, { max: 1 });
        drizzle(client);
        await client`SELECT 1`;
        status.checks.database = {
          status: 'healthy',
          responseTime: Date.now() - startTime,
        };
        client.end();
      } catch (error) {
        status.checks.database = {
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown database error',
        };
        status.status = 'degraded';
      }
    } else {
      status.checks.database = { status: 'not_configured' };
    }

    // Redis health check
    if (process.env.REDIS_URL) {
      const redisHealth = await checkRedisHealth();
      status.checks.redis = redisHealth;
      if (redisHealth.status === 'down') {
        status.status = 'degraded';
      }
    } else {
      status.checks.redis = { status: 'not_configured', message: 'Using DB-backed queue' };
    }

    // Storage health check
    try {
      const { MockStorage } = await import('@/lib/storage');
      const storageHealthy = await MockStorage.testConnection();
      status.checks.storage = {
        status: storageHealthy ? 'healthy' : 'unhealthy',
        type: process.env.AWS_ACCESS_KEY_ID ? 'R2/S3' : 'Mock Storage',
      };
      if (!storageHealthy) status.status = 'degraded';
    } catch (error) {
      status.checks.storage = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown storage error',
      };
      status.status = 'degraded';
    }

    // FFmpeg health check
    try {
      const { execSync } = await import('child_process');
      execSync('ffmpeg -version', { timeout: 5000 });
      status.checks.ffmpeg = { status: 'healthy' };
    } catch {
      status.checks.ffmpeg = { status: 'unhealthy', error: 'FFmpeg not found' };
      status.status = 'degraded';
    }

    // Memory check
    const memUsage = process.memoryUsage();
    status.checks.memory = {
      status: 'healthy',
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
    };

    const responseTime = Date.now() - startTime;
    status.checks.responseTime = {
      status: responseTime < 1000 ? 'healthy' : 'slow',
      ms: responseTime,
    };

    const statusCode = status.status === 'healthy' ? 200 : 503;

    return NextResponse.json(status, {
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
