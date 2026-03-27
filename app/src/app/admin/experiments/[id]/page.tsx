'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  FlaskConical,
  ArrowLeft,
  Pause,
  Play,
  RotateCcw,
  Pencil,
  Clock,
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  Target,
  Zap,
  Shield,
} from 'lucide-react';
import type {
  Experiment,
  ExperimentStatus,
  ExperimentDomain,
  ExperimentVariant,
  VariantMetrics,
  ExperimentAnalysis,
} from '@/lib/experiments/types';

const statusColors: Record<ExperimentStatus, string> = {
  draft: 'bg-gray-500',
  running: 'bg-green-500',
  paused: 'bg-yellow-500',
  completed: 'bg-blue-500',
  rolled_back: 'bg-red-500',
};

const statusIcons: Record<ExperimentStatus, React.ReactNode> = {
  draft: <Minus className="w-4 h-4" />,
  running: <Play className="w-4 h-4" />,
  paused: <Pause className="w-4 h-4" />,
  completed: <CheckCircle2 className="w-4 h-4" />,
  rolled_back: <RotateCcw className="w-4 h-4" />,
};

const domainLabels: Record<ExperimentDomain, string> = {
  analysis: 'Analysis',
  cue_point: 'Cue Point',
  planner: 'Planner',
  transition: 'Transition',
  render: 'Render',
  ui: 'UI/UX',
};

const variantColors = [
  'bg-blue-500',
  'bg-orange-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-cyan-500',
];

function TrafficBar({ variants }: { variants: ExperimentVariant[] }) {
  return (
    <div className="space-y-3">
      <div className="flex h-4 rounded-full overflow-hidden bg-white/5">
        {variants.map((v, i) => (
          <div
            key={v.id}
            className={`${variantColors[i % variantColors.length]} transition-all duration-500`}
            style={{ width: `${v.trafficPercentage}%` }}
            title={`${v.name}: ${v.trafficPercentage}%`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        {variants.map((v, i) => (
          <div key={v.id} className="flex items-center gap-2 text-xs text-gray-400">
            <div className={`w-2.5 h-2.5 rounded-full ${variantColors[i % variantColors.length]}`} />
            <span className="font-medium text-gray-300">{v.name}</span>
            <span>{v.trafficPercentage}%</span>
            {v.isControl && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                control
              </Badge>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricComparisonCard({
  label,
  controlValue,
  treatmentValue,
  unit = '%',
  higherIsBetter = true,
}: {
  label: string;
  controlValue: number;
  treatmentValue: number;
  unit?: string;
  higherIsBetter?: boolean;
}) {
  const diff = treatmentValue - controlValue;
  const percentDiff = controlValue !== 0 ? ((diff / controlValue) * 100) : 0;
  const isPositive = higherIsBetter ? diff > 0 : diff < 0;
  const isNeutral = Math.abs(percentDiff) < 1;

  return (
    <div className="p-4 rounded-lg border border-white/5 bg-black/20">
      <p className="text-xs text-gray-500 mb-2">{label}</p>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm text-gray-400">
            Control: <span className="text-white font-semibold">{controlValue.toFixed(1)}{unit}</span>
          </p>
          <p className="text-sm text-gray-400">
            Treatment: <span className="text-white font-semibold">{treatmentValue.toFixed(1)}{unit}</span>
          </p>
        </div>
        <div className={`flex items-center gap-1 text-sm font-medium ${isNeutral ? 'text-gray-400' : isPositive ? 'text-green-400' : 'text-red-400'}`}>
          {isNeutral ? (
            <Minus className="w-3.5 h-3.5" />
          ) : isPositive ? (
            <TrendingUp className="w-3.5 h-3.5" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5" />
          )}
          {percentDiff > 0 ? '+' : ''}{percentDiff.toFixed(1)}%
        </div>
      </div>
    </div>
  );
}

export default function ExperimentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const experimentId = params?.id as string;

  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [analysis, setAnalysis] = useState<ExperimentAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadExperiment = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/admin/experiments/${experimentId}`);
      if (!response.ok) {
        throw new Error('Failed to load experiment');
      }
      const data = await response.json();
      setExperiment(data.experiment);
      setAnalysis(data.analysis ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load experiment');
    } finally {
      setIsLoading(false);
    }
  }, [experimentId]);

  useEffect(() => {
    loadExperiment();
  }, [loadExperiment]);

  const handleAction = async (action: 'pause' | 'resume' | 'rollback') => {
    if (action === 'rollback' && !confirm('Rollback this experiment? Traffic will shift to the control variant.')) {
      return;
    }
    try {
      setActionLoading(action);
      const response = await fetch(`/api/admin/experiments/${experimentId}/${action}`, {
        method: 'POST',
        headers: action === 'rollback' ? { 'Content-Type': 'application/json' } : undefined,
        body: action === 'rollback' ? JSON.stringify({ gradual: true, durationMinutes: 30 }) : undefined,
      });
      if (!response.ok) throw new Error(`Failed to ${action} experiment`);
      await loadExperiment();
    } catch (err) {
      alert(err instanceof Error ? err.message : `Failed to ${action}`);
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !experiment) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-400 mb-4">{error || 'Experiment not found'}</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={loadExperiment} variant="outline">Retry</Button>
            <Link href="/admin/experiments">
              <Button variant="ghost">Back to Experiments</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const controlVariant = experiment.variants.find(v => v.isControl);
  const treatmentVariants = experiment.variants.filter(v => !v.isControl);
  const controlMetrics = analysis?.variantMetrics.find(m => m.variantId === controlVariant?.id);
  const treatmentMetrics = analysis?.variantMetrics.find(m => m.variantId !== controlVariant?.id);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-white/5 bg-background/60 backdrop-blur-lg sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href="/admin/experiments">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                <FlaskConical className="w-5 h-5 text-primary" />
                <h1 className="text-xl font-bold truncate max-w-md">{experiment.name}</h1>
                <Badge className={`${statusColors[experiment.status]} text-white`}>
                  <span className="flex items-center gap-1">
                    {statusIcons[experiment.status]}
                    {experiment.status}
                  </span>
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {experiment.status === 'running' && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAction('pause')}
                    disabled={actionLoading !== null}
                  >
                    <Pause className="w-4 h-4 mr-1" />
                    {actionLoading === 'pause' ? 'Pausing...' : 'Pause'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAction('rollback')}
                    disabled={actionLoading !== null}
                    className="text-red-400 hover:text-red-300 border-red-500/30 hover:border-red-500/50"
                  >
                    <RotateCcw className="w-4 h-4 mr-1" />
                    {actionLoading === 'rollback' ? 'Rolling back...' : 'Rollback'}
                  </Button>
                </>
              )}
              {experiment.status === 'paused' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAction('resume')}
                  disabled={actionLoading !== null}
                >
                  <Play className="w-4 h-4 mr-1" />
                  {actionLoading === 'resume' ? 'Resuming...' : 'Resume'}
                </Button>
              )}
              <Link href={`/admin/experiments/${experimentId}/edit`}>
                <Button variant="outline" size="sm">
                  <Pencil className="w-4 h-4 mr-1" />
                  Edit
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Experiment Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Description</p>
                  <p className="text-sm text-gray-300">{experiment.description}</p>
                </div>
                {experiment.hypothesis && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Hypothesis</p>
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                      <Target className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                      <p className="text-sm text-blue-300">{experiment.hypothesis}</p>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                  <div>
                    <p className="text-xs text-gray-500">Domain</p>
                    <Badge variant="outline" className="mt-1">{domainLabels[experiment.domain]}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Started</p>
                    <p className="text-sm font-medium mt-1">{new Date(experiment.startDate).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">End Date</p>
                    <p className="text-sm font-medium mt-1">
                      {experiment.endDate ? new Date(experiment.endDate).toLocaleDateString() : 'Open-ended'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Auto-Rollback</p>
                    <p className="text-sm font-medium mt-1 flex items-center gap-1">
                      {experiment.autoRollbackEnabled ? (
                        <><Shield className="w-3.5 h-3.5 text-green-400" /> Enabled</>
                      ) : (
                        <><Shield className="w-3.5 h-3.5 text-gray-500" /> Disabled</>
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Variants */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Variants</CardTitle>
                <CardDescription>Traffic allocation across {experiment.variants.length} variants</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <TrafficBar variants={experiment.variants} />
                <div className="space-y-3">
                  {experiment.variants.map((variant, i) => (
                    <div
                      key={variant.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-white/5 bg-black/20"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${variantColors[i % variantColors.length]}`} />
                        <div>
                          <p className="text-sm font-medium flex items-center gap-2">
                            {variant.name}
                            {variant.isControl && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                                control
                              </Badge>
                            )}
                          </p>
                          {variant.description && (
                            <p className="text-xs text-gray-500">{variant.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <code className="text-xs px-2 py-1 rounded bg-white/5 text-gray-400">
                          {variant.codePath}
                        </code>
                        <span className="font-semibold text-gray-300 w-12 text-right">{variant.trafficPercentage}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Metrics Comparison */}
            {analysis && controlMetrics && treatmentMetrics && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Metrics Comparison
                  </CardTitle>
                  <CardDescription>
                    Generated {new Date(analysis.generatedAt).toLocaleString()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Statistical Significance */}
                  <div className={`p-4 rounded-lg border ${
                    analysis.comparison.isSignificant
                      ? 'bg-green-500/5 border-green-500/20'
                      : 'bg-yellow-500/5 border-yellow-500/20'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {analysis.comparison.isSignificant ? (
                          <CheckCircle2 className="w-5 h-5 text-green-400" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-yellow-400" />
                        )}
                        <span className="font-semibold">
                          {analysis.comparison.isSignificant ? 'Statistically Significant' : 'Not Yet Significant'}
                        </span>
                      </div>
                      <Badge
                        variant="secondary"
                        className={
                          analysis.comparison.recommendation === 'promote'
                            ? 'bg-green-500/20 text-green-300'
                            : analysis.comparison.recommendation === 'rollback'
                              ? 'bg-red-500/20 text-red-300'
                              : analysis.comparison.recommendation === 'continue'
                                ? 'bg-blue-500/20 text-blue-300'
                                : 'bg-gray-500/20 text-gray-300'
                        }
                      >
                        {analysis.comparison.recommendation}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-400">{analysis.comparison.reasoning}</p>
                    <div className="flex gap-6 mt-3 text-xs">
                      {analysis.comparison.pValue !== undefined && (
                        <span className="text-gray-500">
                          p-value: <span className="text-gray-300 font-mono">{analysis.comparison.pValue.toFixed(4)}</span>
                        </span>
                      )}
                      {analysis.comparison.improvement !== undefined && (
                        <span className="text-gray-500">
                          Improvement: <span className={`font-mono ${analysis.comparison.improvement > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {analysis.comparison.improvement > 0 ? '+' : ''}{analysis.comparison.improvement.toFixed(1)}%
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Metric Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <MetricComparisonCard
                      label="Success Rate"
                      controlValue={controlMetrics.metrics.successRate * 100}
                      treatmentValue={treatmentMetrics.metrics.successRate * 100}
                      higherIsBetter={true}
                    />
                    <MetricComparisonCard
                      label="Error Rate"
                      controlValue={controlMetrics.metrics.errorRate * 100}
                      treatmentValue={treatmentMetrics.metrics.errorRate * 100}
                      higherIsBetter={false}
                    />
                    <MetricComparisonCard
                      label="Avg Latency"
                      controlValue={controlMetrics.metrics.averageLatencyMs}
                      treatmentValue={treatmentMetrics.metrics.averageLatencyMs}
                      unit="ms"
                      higherIsBetter={false}
                    />
                    <MetricComparisonCard
                      label="User Satisfaction"
                      controlValue={controlMetrics.metrics.userSatisfaction * 100}
                      treatmentValue={treatmentMetrics.metrics.userSatisfaction * 100}
                      higherIsBetter={true}
                    />
                    <MetricComparisonCard
                      label="QA Pass Rate"
                      controlValue={controlMetrics.metrics.qaPassRate * 100}
                      treatmentValue={treatmentMetrics.metrics.qaPassRate * 100}
                      higherIsBetter={true}
                    />
                    <MetricComparisonCard
                      label="Export Rate"
                      controlValue={controlMetrics.metrics.exportRate * 100}
                      treatmentValue={treatmentMetrics.metrics.exportRate * 100}
                      higherIsBetter={true}
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right column - Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Users className="w-4 h-4" />
                    Total Samples
                  </div>
                  <span className="font-semibold">
                    {analysis?.variantMetrics.reduce((sum, m) => sum + m.sampleSize, 0).toLocaleString() ?? '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Zap className="w-4 h-4" />
                    Variants
                  </div>
                  <span className="font-semibold">{experiment.variants.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <TrendingUp className="w-4 h-4" />
                    Traffic
                  </div>
                  <span className="font-semibold">{experiment.trafficAllocation}%</span>
                </div>
                <Progress value={experiment.trafficAllocation} variant="default" showValue />
              </CardContent>
            </Card>

            {/* Rollback Thresholds */}
            {experiment.autoRollbackEnabled && experiment.rollbackThresholds && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="w-4 h-4 text-green-400" />
                    Rollback Thresholds
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Max Error Rate Increase</span>
                    <span className="font-mono">{experiment.rollbackThresholds.maxErrorRateIncrease}x</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Max Latency Increase</span>
                    <span className="font-mono">{experiment.rollbackThresholds.maxLatencyIncreaseMs}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Min Satisfaction</span>
                    <span className="font-mono">{(experiment.rollbackThresholds.minSatisfactionScore * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Max QA Failure Rate</span>
                    <span className="font-mono">{(experiment.rollbackThresholds.maxQaFailureRate * 100).toFixed(0)}%</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-gray-500" />
                  <div>
                    <p className="text-gray-400">Created</p>
                    <p className="font-medium">{new Date(experiment.createdAt).toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <div>
                    <p className="text-gray-400">Started</p>
                    <p className="font-medium">{new Date(experiment.startDate).toLocaleString()}</p>
                  </div>
                </div>
                {experiment.endDate && (
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <div>
                      <p className="text-gray-400">Ends</p>
                      <p className="font-medium">{new Date(experiment.endDate).toLocaleString()}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-gray-600" />
                  <div>
                    <p className="text-gray-400">Last Updated</p>
                    <p className="font-medium">{new Date(experiment.updatedAt).toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* No metrics placeholder */}
            {!analysis && experiment.status === 'running' && (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center">
                  <BarChart3 className="w-8 h-8 text-gray-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No metrics data yet</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Metrics will appear once enough samples are collected
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
