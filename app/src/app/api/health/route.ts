// Production health check endpoint
// Returns system status for monitoring and load balancers

import { NextResponse } from 'next/server';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

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
        const connectionString = process.env.DATABASE_URL;
        const client = postgres(connectionString, { max: 1 });
        drizzle(client);
        
        // Simple database ping
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
      status.checks.database = {
        status: 'not_configured',
        message: 'DATABASE_URL not set',
      };
    }

    // Storage health check
    try {
      const { MockStorage } = await import('@/lib/storage');
      const storageHealthy = await MockStorage.testConnection();
      status.checks.storage = {
        status: storageHealthy ? 'healthy' : 'unhealthy',
        type: process.env.AWS_ACCESS_KEY_ID ? 'AWS S3' : 'Mock Storage',
      };
      if (!storageHealthy) {
        status.status = 'degraded';
      }
    } catch (error) {
      status.checks.storage = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown storage error',
      };
      status.status = 'degraded';
    }

    // Memory check
    const memUsage = process.memoryUsage();
    status.checks.memory = {
      status: 'healthy',
      rss: Math.round(memUsage.rss / 1024 / 1024), // MB
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
    };

    // Response time
    const responseTime = Date.now() - startTime;
    status.checks.responseTime = {
      status: responseTime < 1000 ? 'healthy' : 'slow',
      ms: responseTime,
    };

    // HTTP status code based on overall health
    const statusCode = status.status === 'healthy' ? 200 : 503;

    return NextResponse.json(status, { 
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
