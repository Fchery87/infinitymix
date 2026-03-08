'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Shield, AlertTriangle, CheckCircle, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/helpers';
import Link from 'next/link';

type RenderRecord = {
  id: string;
  userId: string;
  userEmail: string | null;
  generationStatus: string;
  qaResults: {
    mixMetrics?: {
      integratedLoudness?: number;
      truePeak?: number;
      dynamicRangeWarning?: boolean;
      clippingIncidence?: number;
    }
  } | null;
  retryReason: string | null;
  generationTimeMs: number | null;
  createdAt: string;
};

export function RenderObservabilityDashboard({ adminUser }: { adminUser: { id?: string | null; email?: string | null; name?: string | null } }) {
  const [renders, setRenders] = useState<RenderRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/admin/renders?limit=100', { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to load renders');
        const json = await res.json();
        if (!cancelled) setRenders(json.renders ?? []);
      } catch (error) {
        console.error(error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void loadData();
    return () => { cancelled = true; };
  }, [refreshTick]);

  return (
    <div className="min-h-screen text-foreground">
      <div className="fixed inset-0 -z-10 bg-background" />
      <div className="fixed -z-10 top-0 left-1/2 -translate-x-1/2 h-[360px] w-[1100px] rounded-full bg-purple-500/10 blur-[110px]" />
      
      <header className="sticky top-0 z-20 border-b border-white/5 bg-background/60 backdrop-blur-lg">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-tr from-purple-500 to-pink-500 shadow-lg shadow-purple-500/20">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">InfinityMix Admin</p>
              <p className="text-xs text-gray-400">Render QA Enforcement</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/audio-observability">
              <Button variant="ghost" className="text-gray-300 hover:text-white">Analysis Dashboard</Button>
            </Link>
            <Button
              variant="glow"
              className="gap-2"
              onClick={() => setRefreshTick((v) => v + 1)}
              disabled={isLoading}
            >
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
        <section className="mb-8">
          <h1 className="text-4xl font-extrabold tracking-tight text-white md:text-5xl">
            Render QA Observability
          </h1>
          <p className="mt-3 max-w-3xl text-gray-400">
            Monitor output quality of generated mashups, enforce dynamic range and clipping limits, and view correction reasons.
          </p>
        </section>

        <Card className="bg-card/60 border-white/5">
          <CardHeader>
            <CardTitle>Recent renders and QA evaluations</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && renders.length === 0 ? (
              <div className="py-20 text-center text-gray-400">Loading renders...</div>
            ) : renders.length === 0 ? (
              <div className="py-20 text-center text-gray-400">No renders found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-300">
                  <thead className="border-b border-white/5 bg-black/40 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-3">Mashup details</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">QA Reason (If failed)</th>
                      <th className="px-4 py-3">Integrated LUFS</th>
                      <th className="px-4 py-3">True Peak dB</th>
                      <th className="px-4 py-3">Clipping</th>
                      <th className="px-4 py-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {renders.map((render) => {
                      const qa = render.qaResults?.mixMetrics;
                      const hasClipping = qa?.clippingIncidence && qa.clippingIncidence > 0;
                      const hasLoudnessFail = qa?.integratedLoudness && Math.abs(qa.integratedLoudness - (-14)) > 2;

                      return (
                        <tr key={render.id} className="hover:bg-white/5">
                          <td className="px-4 py-4">
                            <div className="font-medium text-white">{render.id}</div>
                            <div className="text-xs text-gray-500">{render.userEmail}</div>
                          </td>
                          <td className="px-4 py-4">
                            <span className={cn(
                              'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium',
                              render.generationStatus === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                              render.generationStatus === 'failed' ? 'bg-red-500/10 text-red-400' :
                              'bg-amber-500/10 text-amber-400'
                            )}>
                              {render.generationStatus === 'completed' && <CheckCircle className="h-3 w-3" />}
                              {render.generationStatus === 'failed' && <AlertTriangle className="h-3 w-3" />}
                              {render.generationStatus !== 'completed' && render.generationStatus !== 'failed' && <Activity className="h-3 w-3" />}
                              {render.generationStatus}
                            </span>
                          </td>
                          <td className="px-4 py-4 max-w-xs text-red-300">
                            {render.retryReason || '-'}
                          </td>
                          <td className={cn("px-4 py-4", hasLoudnessFail && "text-red-400 font-semibold")}>
                            {qa?.integratedLoudness?.toFixed(2) ?? '-'}
                          </td>
                          <td className={cn("px-4 py-4", (qa?.truePeak && qa.truePeak >= -0.5) && "text-red-400 font-semibold")}>
                            {qa?.truePeak?.toFixed(2) ?? '-'}
                          </td>
                          <td className="px-4 py-4">
                            {hasClipping ? (
                              <span className="text-red-400 font-semibold">{qa.clippingIncidence}</span>
                            ) : (
                              qa ? '0' : '-'
                            )}
                          </td>
                          <td className="px-4 py-4 text-xs text-gray-500">
                            {new Date(render.createdAt).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
