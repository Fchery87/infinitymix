'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  FlaskConical,
  ArrowLeft,
  Plus,
  Trash2,
  Target,
  AlertTriangle,
} from 'lucide-react';
import type { Experiment, ExperimentDomain, ExperimentVariant } from '@/lib/experiments/types';

const domainLabels: Record<ExperimentDomain, string> = {
  analysis: 'Analysis',
  cue_point: 'Cue Point',
  planner: 'Planner',
  transition: 'Transition',
  render: 'Render',
  ui: 'UI/UX',
};

interface VariantForm {
  id: string;
  name: string;
  description: string;
  codePath: string;
  trafficPercentage: number;
  isControl: boolean;
}

let variantIdCounter = 100;

export default function EditExperimentPage() {
  const params = useParams();
  const router = useRouter();
  const experimentId = params?.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [domain, setDomain] = useState<ExperimentDomain>('planner');
  const [hypothesis, setHypothesis] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [trafficAllocation, setTrafficAllocation] = useState(100);
  const [autoRollback, setAutoRollback] = useState(true);
  const [variants, setVariants] = useState<VariantForm[]>([]);

  const loadExperiment = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const response = await fetch(`/api/admin/experiments/${experimentId}`);
      if (!response.ok) throw new Error('Failed to load experiment');
      const data = await response.json();
      const exp: Experiment = data.experiment;

      setName(exp.name);
      setDescription(exp.description);
      setDomain(exp.domain);
      setHypothesis(exp.hypothesis || '');
      setStartDate(exp.startDate ? new Date(exp.startDate).toISOString().split('T')[0] : '');
      setEndDate(exp.endDate ? new Date(exp.endDate).toISOString().split('T')[0] : '');
      setTrafficAllocation(exp.trafficAllocation);
      setAutoRollback(exp.autoRollbackEnabled);
      setVariants(
        exp.variants.map((v: ExperimentVariant) => ({
          id: v.id || `var-${++variantIdCounter}`,
          name: v.name,
          description: v.description || '',
          codePath: v.codePath,
          trafficPercentage: v.trafficPercentage,
          isControl: v.isControl,
        }))
      );
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load experiment');
    } finally {
      setIsLoading(false);
    }
  }, [experimentId]);

  useEffect(() => {
    loadExperiment();
  }, [loadExperiment]);

  const addVariant = () => {
    const totalTraffic = variants.reduce((sum, v) => sum + v.trafficPercentage, 0);
    setVariants([
      ...variants,
      {
        id: `var-${++variantIdCounter}`,
        name: `variant-${variants.length}`,
        description: '',
        codePath: '',
        trafficPercentage: Math.max(0, 100 - totalTraffic),
        isControl: false,
      },
    ]);
  };

  const removeVariant = (id: string) => {
    if (variants.length <= 2) return;
    setVariants(variants.filter(v => v.id !== id));
  };

  const updateVariant = (id: string, field: keyof VariantForm, value: string | number | boolean) => {
    if (field === 'isControl' && value === true) {
      setVariants(prev => prev.map(v => ({ ...v, isControl: v.id === id })));
    } else {
      setVariants(variants.map(v => (v.id === id ? { ...v, [field]: value } : v)));
    }
  };

  const totalVariantTraffic = variants.reduce((sum, v) => sum + v.trafficPercentage, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) { setError('Experiment name is required'); return; }
    if (!description.trim()) { setError('Description is required'); return; }
    if (!startDate) { setError('Start date is required'); return; }
    if (totalVariantTraffic !== 100) { setError(`Variant traffic must total 100% (currently ${totalVariantTraffic}%)`); return; }
    if (!variants.some(v => v.isControl)) { setError('One variant must be marked as control'); return; }
    if (variants.some(v => !v.codePath.trim())) { setError('All variants must have a code path'); return; }

    try {
      setIsSubmitting(true);
      const response = await fetch(`/api/admin/experiments/${experimentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          domain,
          hypothesis: hypothesis.trim() || undefined,
          startDate: new Date(startDate).toISOString(),
          endDate: endDate ? new Date(endDate).toISOString() : undefined,
          trafficAllocation,
          autoRollbackEnabled: autoRollback,
          variants: variants.map(v => ({
            id: v.id.startsWith('var-') ? undefined : v.id,
            name: v.name.trim(),
            description: v.description.trim() || undefined,
            codePath: v.codePath.trim(),
            trafficPercentage: v.trafficPercentage,
            isControl: v.isControl,
          })),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update experiment');
      }

      router.push(`/admin/experiments/${experimentId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update experiment');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-400 mb-4">{loadError}</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={loadExperiment} variant="outline">Retry</Button>
            <Link href="/admin/experiments">
              <Button variant="ghost">Back</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-white/5 bg-background/60 backdrop-blur-lg sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href={`/admin/experiments/${experimentId}`}>
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                <FlaskConical className="w-5 h-5 text-primary" />
                <h1 className="text-xl font-bold">Edit Experiment</h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm text-gray-400 mb-1.5">Experiment Name *</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., planner-2026-03-v2" />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm text-gray-400 mb-1.5">Description *</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="flex w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm text-foreground shadow-inner placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary min-h-[80px] resize-y"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Domain *</label>
                  <select
                    value={domain}
                    onChange={(e) => setDomain(e.target.value as ExperimentDomain)}
                    className="flex h-12 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-sm text-foreground shadow-inner focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary"
                  >
                    {(Object.keys(domainLabels) as ExperimentDomain[]).map((d) => (
                      <option key={d} value={d}>{domainLabels[d]}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Traffic Allocation</label>
                  <div className="flex items-center gap-3">
                    <Input type="number" min={1} max={100} value={trafficAllocation} onChange={(e) => setTrafficAllocation(Number(e.target.value))} className="w-24" />
                    <span className="text-sm text-gray-500">% of total users</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Start Date *</label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">End Date (optional)</label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm text-gray-400 mb-1.5">Hypothesis</label>
                  <div className="flex items-start gap-2">
                    <Target className="w-4 h-4 text-blue-400 mt-3 shrink-0" />
                    <textarea
                      value={hypothesis}
                      onChange={(e) => setHypothesis(e.target.value)}
                      className="flex w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm text-foreground shadow-inner placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary min-h-[60px] resize-y"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setAutoRollback(!autoRollback)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoRollback ? 'bg-primary' : 'bg-white/10'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoRollback ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                  <div>
                    <p className="text-sm font-medium">Auto-Rollback</p>
                    <p className="text-xs text-gray-500">Automatically rollback if quality thresholds are breached</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Variants */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Variants</CardTitle>
                  <CardDescription>
                    Traffic must total 100%
                    <span className={`ml-2 font-mono ${totalVariantTraffic === 100 ? 'text-green-400' : 'text-yellow-400'}`}>
                      ({totalVariantTraffic}%)
                    </span>
                  </CardDescription>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addVariant}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Variant
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {variants.map((variant, index) => (
                <div key={variant.id} className="p-4 rounded-lg border border-white/5 bg-black/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 font-mono">#{index + 1}</span>
                      {variant.isControl && <Badge variant="outline" className="text-[10px]">control</Badge>}
                    </div>
                    <div className="flex items-center gap-2">
                      {!variant.isControl && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => updateVariant(variant.id, 'isControl', true)} className="text-xs text-gray-500 hover:text-white">
                          Set as control
                        </Button>
                      )}
                      {variants.length > 2 && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeVariant(variant.id)} className="text-red-400 hover:text-red-300">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Name *</label>
                      <Input value={variant.name} onChange={(e) => updateVariant(variant.id, 'name', e.target.value)} className="h-9 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Code Path *</label>
                      <Input value={variant.codePath} onChange={(e) => updateVariant(variant.id, 'codePath', e.target.value)} className="h-9 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Traffic %</label>
                      <Input type="number" min={0} max={100} value={variant.trafficPercentage} onChange={(e) => updateVariant(variant.id, 'trafficPercentage', Number(e.target.value))} className="h-9 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Description</label>
                      <Input value={variant.description} onChange={(e) => updateVariant(variant.id, 'description', e.target.value)} className="h-9 text-sm" />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pb-8">
            <Link href={`/admin/experiments/${experimentId}`}>
              <Button type="button" variant="ghost">Cancel</Button>
            </Link>
            <Button type="submit" disabled={isSubmitting} className="min-w-[160px]">
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Saving...
                </span>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
