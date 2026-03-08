'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  FlaskConical, 
  Plus, 
  Pause, 
  Play, 
  RotateCcw, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronRight,
  BarChart3
} from 'lucide-react';
import type { 
  Experiment, 
  ExperimentStatus, 
  ExperimentDomain,
  VariantMetrics,
  ExperimentAnalysis 
} from '@/lib/experiments/types';

const statusColors: Record<ExperimentStatus, string> = {
  draft: 'bg-gray-500',
  running: 'bg-green-500',
  paused: 'bg-yellow-500',
  completed: 'bg-blue-500',
  rolled_back: 'bg-red-500',
};

const domainLabels: Record<ExperimentDomain, string> = {
  analysis: 'Analysis',
  cue_point: 'Cue Point',
  planner: 'Planner',
  transition: 'Transition',
  render: 'Render',
  ui: 'UI/UX',
};

interface ExperimentListItem {
  id: string;
  name: string;
  domain: ExperimentDomain;
  status: ExperimentStatus;
  description: string;
  startDate: string;
  endDate?: string;
  trafficAllocation: number;
  variantCount: number;
  sampleSize: number;
}

export default function ExperimentsAdminPage() {
  const [experiments, setExperiments] = useState<ExperimentListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadExperiments = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/experiments');
      if (!response.ok) {
        throw new Error('Failed to load experiments');
      }
      const data = await response.json();
      setExperiments(data.experiments || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load experiments');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExperiments();
  }, [loadExperiments]);

  const handlePause = async (experimentId: string) => {
    try {
      const response = await fetch(`/api/admin/experiments/${experimentId}/pause`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to pause experiment');
      await loadExperiments();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to pause');
    }
  };

  const handleResume = async (experimentId: string) => {
    try {
      const response = await fetch(`/api/admin/experiments/${experimentId}/resume`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to resume experiment');
      await loadExperiments();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to resume');
    }
  };

  const handleRollback = async (experimentId: string) => {
    if (!confirm('Are you sure you want to rollback this experiment? All traffic will be shifted to the control variant.')) {
      return;
    }
    try {
      const response = await fetch(`/api/admin/experiments/${experimentId}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gradual: true, durationMinutes: 30 }),
      });
      if (!response.ok) throw new Error('Failed to rollback experiment');
      await loadExperiments();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to rollback');
    }
  };

  const activeExperiments = experiments.filter(e => e.status === 'running');
  const totalSampleSize = experiments.reduce((sum, e) => sum + e.sampleSize, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-white/5 bg-background/60 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href="/admin/audio-observability">
                <Button variant="ghost" size="sm">
                  ← Back to Admin
                </Button>
              </Link>
              <h1 className="text-xl font-bold">Experiments Dashboard</h1>
            </div>
            <Link href="/admin/experiments/new">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Experiment
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Active Experiments</p>
                  <p className="text-3xl font-bold">{activeExperiments.length}</p>
                </div>
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <FlaskConical className="w-6 h-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Sample Size</p>
                  <p className="text-3xl font-bold">{totalSampleSize.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <BarChart3 className="w-6 h-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Running</p>
                  <p className="text-3xl font-bold text-green-500">
                    {experiments.filter(e => e.status === 'running').length}
                  </p>
                </div>
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <Play className="w-6 h-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Needs Attention</p>
                  <p className="text-3xl font-bold text-yellow-500">
                    {experiments.filter(e => e.status === 'paused').length}
                  </p>
                </div>
                <div className="p-3 bg-yellow-500/10 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-yellow-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Experiments List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5" />
              All Experiments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : error ? (
              <div className="text-center py-12 text-red-500">
                <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
                <p>{error}</p>
                <Button onClick={loadExperiments} variant="outline" className="mt-4">
                  Retry
                </Button>
              </div>
            ) : experiments.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FlaskConical className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No experiments yet</p>
                <p className="text-sm mt-2">Create your first experiment to start testing</p>
              </div>
            ) : (
              <div className="space-y-4">
                {experiments.map((experiment) => (
                  <div
                    key={experiment.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-white/10 bg-black/20 hover:bg-black/30 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold truncate">{experiment.name}</h3>
                        <Badge 
                          variant="secondary"
                          className={`${statusColors[experiment.status]} text-white`}
                        >
                          {experiment.status}
                        </Badge>
                        <Badge variant="outline">
                          {domainLabels[experiment.domain]}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500 truncate mb-2">
                        {experiment.description}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Started {new Date(experiment.startDate).toLocaleDateString()}
                        </span>
                        <span>•</span>
                        <span>{experiment.variantCount} variants</span>
                        <span>•</span>
                        <span>{experiment.trafficAllocation}% traffic</span>
                        <span>•</span>
                        <span>{experiment.sampleSize.toLocaleString()} samples</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      {experiment.status === 'running' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePause(experiment.id)}
                          >
                            <Pause className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRollback(experiment.id)}
                            className="text-red-500 hover:text-red-400"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      {experiment.status === 'paused' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleResume(experiment.id)}
                        >
                          <Play className="w-4 h-4" />
                        </Button>
                      )}
                      <Link href={`/admin/experiments/${experiment.id}`}>
                        <Button variant="ghost" size="sm">
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Quick Start Templates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start">
                <TrendingUp className="w-4 h-4 mr-2" />
                A/B Test Planner Algorithm
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Test New Transition Style
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <BarChart3 className="w-4 h-4 mr-2" />
                Compare Render Quality
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Documentation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-gray-500">
                Learn how to create and manage experiments effectively.
              </p>
              <ul className="space-y-1 text-gray-400">
                <li>• Experiments run for a minimum of 7 days</li>
                <li>• Automatic rollback on quality thresholds</li>
                <li>• Stable user assignment via hashing</li>
                <li>• Real-time metrics and significance testing</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
