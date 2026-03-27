'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Activity,
  Database,
  HardDrive,
  Server,
  Zap,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  Cpu,
  Wifi,
  WifiOff,
} from 'lucide-react';

type ServiceStatus = 'healthy' | 'degraded' | 'down' | 'unknown';

type HealthData = {
  timestamp: string;
  overall: ServiceStatus;
  services: {
    database: {
      status: ServiceStatus;
      responseMs: number;
      poolActive: number;
      poolMax: number;
    };
    redis: {
      status: ServiceStatus;
      responseMs: number;
      memoryUsedMb: number;
    };
    r2Storage: {
      status: ServiceStatus;
      totalObjects: number;
      totalSizeGb: number;
    };
    workers: {
      analyzer: { status: ServiceStatus; queueDepth: number; lastHeartbeat: string | null };
      renderer: { status: ServiceStatus; queueDepth: number; lastHeartbeat: string | null };
      worker: { status: ServiceStatus; queueDepth: number; lastHeartbeat: string | null };
    };
  };
  queues: {
    name: string;
    depth: number;
    processing: number;
    failed: number;
  }[];
  recentErrors: {
    id: string;
    service: string;
    message: string;
    timestamp: string;
    severity: 'warn' | 'error' | 'fatal';
  }[];
};

const statusColors: Record<ServiceStatus, string> = {
  healthy: 'bg-green-500',
  degraded: 'bg-yellow-500',
  down: 'bg-red-500',
  unknown: 'bg-gray-500',
};

const statusIcons: Record<ServiceStatus, typeof CheckCircle2> = {
  healthy: CheckCircle2,
  degraded: AlertTriangle,
  down: XCircle,
  unknown: Clock,
};

const severityColors: Record<string, string> = {
  warn: 'text-yellow-500 bg-yellow-500/10',
  error: 'text-red-500 bg-red-500/10',
  fatal: 'text-red-700 bg-red-700/10',
};

function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function AdminHealthPage() {
  const [data, setData] = useState<HealthData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const loadHealth = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch('/api/admin/health');
      if (!response.ok) throw new Error('Failed to load health data');
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load health data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(loadHealth, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadHealth]);

  const StatusBadge = ({ status }: { status: ServiceStatus }) => {
    const Icon = statusIcons[status];
    return (
      <Badge variant="secondary" className={`${statusColors[status]} text-white flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {status}
      </Badge>
    );
  };

  const WorkerCard = ({
    name,
    worker,
    icon: Icon,
  }: {
    name: string;
    worker: { status: ServiceStatus; queueDepth: number; lastHeartbeat: string | null };
    icon: typeof Cpu;
  }) => (
    <div className="p-4 bg-black/20 rounded-lg border border-white/5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-gray-400" />
          <span className="font-medium">{name}</span>
        </div>
        <StatusBadge status={worker.status} />
      </div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Queue Depth</span>
          <span className={worker.queueDepth > 50 ? 'text-yellow-500 font-medium' : ''}>
            {worker.queueDepth}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Last Heartbeat</span>
          <span>{worker.lastHeartbeat ? timeAgo(worker.lastHeartbeat) : 'Never'}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-white/5 bg-background/60 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href="/admin">
                <Button variant="ghost" size="sm">Back to Admin</Button>
              </Link>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Activity className="w-5 h-5" /> System Health
              </h1>
              {data && (
                <Badge variant="secondary" className={`${statusColors[data.overall]} text-white`}>
                  {data.overall}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant={autoRefresh ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                {autoRefresh ? <Wifi className="w-4 h-4 mr-1" /> : <WifiOff className="w-4 h-4 mr-1" />}
                Auto-refresh {autoRefresh ? 'on' : 'off'}
              </Button>
              <Button variant="outline" size="sm" onClick={loadHealth}>
                <RefreshCw className="w-4 h-4 mr-1" /> Refresh
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : error ? (
          <div className="text-center py-24 text-red-500">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
            <p>{error}</p>
            <Button onClick={loadHealth} variant="outline" className="mt-4">Retry</Button>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Core Services */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Database */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-blue-500/10 rounded-lg">
                        <Database className="w-5 h-5 text-blue-500" />
                      </div>
                      <span className="font-medium">PostgreSQL</span>
                    </div>
                    <StatusBadge status={data.services.database.status} />
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Response</span>
                      <span>{data.services.database.responseMs}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Pool</span>
                      <span>{data.services.database.poolActive}/{data.services.database.poolMax}</span>
                    </div>
                    <Progress
                      value={data.services.database.poolActive}
                      max={data.services.database.poolMax}
                      variant={data.services.database.poolActive / data.services.database.poolMax > 0.8 ? 'warning' : 'default'}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Redis */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-red-500/10 rounded-lg">
                        <Zap className="w-5 h-5 text-red-500" />
                      </div>
                      <span className="font-medium">Redis</span>
                    </div>
                    <StatusBadge status={data.services.redis.status} />
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Response</span>
                      <span>{data.services.redis.responseMs}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Memory</span>
                      <span>{data.services.redis.memoryUsedMb} MB</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* R2 Storage */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-purple-500/10 rounded-lg">
                        <HardDrive className="w-5 h-5 text-purple-500" />
                      </div>
                      <span className="font-medium">R2 Storage</span>
                    </div>
                    <StatusBadge status={data.services.r2Storage.status} />
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Objects</span>
                      <span>{data.services.r2Storage.totalObjects.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Size</span>
                      <span>{data.services.r2Storage.totalSizeGb.toFixed(2)} GB</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Worker Services */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Server className="w-5 h-5" /> Worker Services
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <WorkerCard
                    name="Analyzer"
                    worker={data.services.workers.analyzer}
                    icon={Cpu}
                  />
                  <WorkerCard
                    name="Renderer"
                    worker={data.services.workers.renderer}
                    icon={Layers}
                  />
                  <WorkerCard
                    name="Worker"
                    worker={data.services.workers.worker}
                    icon={Server}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Queue Depths */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Layers className="w-5 h-5" /> Queue Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.queues.map((queue) => (
                    <div
                      key={queue.name}
                      className="flex items-center justify-between p-3 bg-black/20 rounded-lg border border-white/5"
                    >
                      <span className="font-medium">{queue.name}</span>
                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-center">
                          <p className="text-lg font-bold">{queue.depth}</p>
                          <p className="text-xs text-gray-500">Queued</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-blue-500">{queue.processing}</p>
                          <p className="text-xs text-gray-500">Processing</p>
                        </div>
                        <div className="text-center">
                          <p className={`text-lg font-bold ${queue.failed > 0 ? 'text-red-500' : ''}`}>
                            {queue.failed}
                          </p>
                          <p className="text-xs text-gray-500">Failed</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Errors */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" /> Recent Errors
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.recentErrors.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-green-500" />
                    <p>No recent errors</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.recentErrors.map((err) => (
                      <div
                        key={err.id}
                        className="p-3 bg-black/20 rounded-lg border border-white/5"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${severityColors[err.severity]}`}>
                              {err.severity}
                            </span>
                            <span className="text-sm text-gray-400">{err.service}</span>
                          </div>
                          <span className="text-xs text-gray-500">{timeAgo(err.timestamp)}</span>
                        </div>
                        <p className="text-sm text-gray-300 font-mono truncate">{err.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </main>
    </div>
  );
}
