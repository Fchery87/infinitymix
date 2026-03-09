'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileAudio, Trash2, Scissors, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/helpers';
import { StemPlayer } from '@/components/stem-player';

export interface Track {
  id: string;
  original_filename: string;
  analysis_status: 'pending' | 'analyzing' | 'completed' | 'failed';
  bpm: number | null;
  musical_key: string | null;
  camelot_key?: string | null;
  bpm_confidence?: number | null;
  key_confidence?: number | null;
  analysis_quality?: string | null;
  analysis_version?: string | null;
  browser_analysis_confidence?: number | null;
  browser_hint_decision_reason?: string | null;
  analysis_features?: {
    version: 'mir-v1';
    source: 'essentia' | 'meyda' | 'hybrid';
    extractionMs?: number | null;
    descriptors: {
      rms?: number | null;
      energy?: number | null;
      zcr?: number | null;
      spectralCentroid?: number | null;
      spectralRolloff?: number | null;
      flatnessDb?: number | null;
      crest?: number | null;
    };
  } | null;
  beat_grid?: number[];
  waveform_lite?: number[];
  drop_moments?: number[];
  structure?: Array<{ label: string; start: number; end: number; confidence: number }>;
  has_stems?: boolean;
  created_at: string;
}

function Waveform({ beatGrid, waveformLite }: { beatGrid?: number[]; waveformLite?: number[] }) {
  if (waveformLite && waveformLite.length > 0) {
    const peak = Math.max(...waveformLite, 1);
    const normalized = waveformLite.slice(0, 200).map((v) => Math.min(1, v / peak));
    return (
      <div className="mt-2 flex h-12 items-end gap-0.5 overflow-hidden">
        {normalized.map((v, idx) => (
          <div
            key={idx}
            className="flex-1 rounded-sm bg-gradient-to-t from-primary/30 via-primary/60 to-white/80"
            style={{ height: `${Math.max(8, Math.round(v * 100))}%` }}
          />
        ))}
      </div>
    );
  }

  if (!beatGrid || beatGrid.length < 2) return null;
  const intervals = beatGrid.slice(1).map((t, i) => Math.max(0.05, Math.min(1, (t - beatGrid[i]) / 2)));
  const bars = intervals.slice(0, 32);
  return (
    <div className="mt-2 flex h-10 items-end gap-0.5 overflow-hidden">
      {bars.map((v, idx) => (
        <div
          key={idx}
          className="flex-1 rounded-sm bg-gradient-to-t from-primary/40 via-primary/60 to-white/70"
          style={{ height: `${Math.min(100, Math.round(v * 120))}%`, minHeight: '12%' }}
        />
      ))}
    </div>
  );
}

interface TrackListProps {
  tracks: Track[];
  onRemoveTrack?: (id: string) => void;
  onStemsUpdated?: () => void;
  className?: string;
  isLoading?: boolean;
}

export function TrackList({ tracks, onRemoveTrack, onStemsUpdated, className, isLoading }: TrackListProps) {
  const [separatingIds, setSeparatingIds] = useState<Set<string>>(new Set());

  const handleSeparateStems = async (trackId: string) => {
    setSeparatingIds((prev) => new Set(prev).add(trackId));
    
    try {
      const response = await fetch(`/api/audio/stems/${trackId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quality: 'draft' }),
      });
      
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Failed to start stem separation');
      }
      
      // Trigger refresh to show updated status
      onStemsUpdated?.();
    } catch (error) {
      console.error('Stem separation error:', error);
      alert(error instanceof Error ? error.message : 'Failed to separate stems');
    } finally {
      // Keep showing spinner until parent refreshes and shows has_stems
      setTimeout(() => {
        setSeparatingIds((prev) => {
          const next = new Set(prev);
          next.delete(trackId);
          return next;
        });
      }, 2000);
    }
  };

  if (isLoading) {
    return (
      <div className={cn("mt-12 space-y-3", className)}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-white">Track Pool</h3>
          <span className="text-sm text-gray-500">Loading...</span>
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 bg-card/40 border border-white/5 rounded-xl">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-white/10 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-white/10 rounded animate-pulse w-1/2" />
                <div className="h-3 bg-white/10 rounded animate-pulse w-1/4" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <AnimatePresence>
      {tracks.length > 0 && (
        <div className={cn("mt-12", className)}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-white">Track Pool</h3>
            <span className="text-sm text-gray-500">{tracks.length} tracks loaded</span>
          </div>
          
          <div className="grid gap-3">
            {tracks.map((track, index) => (
              <motion.div
                key={track.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.08 }}
                className="group p-4 bg-card/40 hover:bg-card/60 border border-white/5 hover:border-primary/20 rounded-xl backdrop-blur-sm transition-all duration-200"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center space-x-4 flex-1">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-black/40 border border-white/5 ${
                      track.analysis_status === 'completed' ? 'text-primary' : 'text-gray-500'
                    }`}>
                      <FileAudio className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-white group-hover:text-primary transition-colors truncate">
                        {track.original_filename}
                      </p>
                      <div className="flex items-center space-x-3 text-sm text-gray-500 mt-1">
                        <span className="flex items-center">
                           {track.analysis_status === 'completed' ? (
                             <>
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-2" />
                              {track.bpm ? `${track.bpm} BPM` : 'BPM' }
                             </>
                           ) : (
                             <span className="text-xs">Analyzing...</span>
                           )}
                        </span>
                        {track.musical_key && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-gray-700" />
                            <span>{track.musical_key}</span>
                          </>
                        )}
                        {track.camelot_key && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-gray-700" />
                            <span className="text-xs text-primary/80">{track.camelot_key}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    {/* Stems Status/Button */}
                    {track.analysis_status === 'completed' && (
                      track.has_stems ? (
                        <div className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs font-medium border border-purple-500/20 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Stems Ready
                        </div>
                      ) : separatingIds.has(track.id) ? (
                        <div className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs font-medium border border-purple-500/20 flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Separating...
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSeparateStems(track.id)}
                          className="h-7 px-3 text-xs text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 border border-purple-500/20"
                        >
                          <Scissors className="w-3 h-3 mr-1" />
                          Separate Stems
                        </Button>
                      )
                    )}
                    
                    {/* Analysis Status */}
                    {track.analysis_status === 'completed' ? (
                      <div className="flex items-center gap-2">
                        {track.analysis_quality === 'browser_hint' && (
                          <div className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-300 text-xs font-medium border border-amber-500/20">
                            Browser Analyzed
                          </div>
                        )}
                        <div className="px-3 py-1 rounded-full bg-green-500/10 text-green-500 text-xs font-medium border border-green-500/20">
                          Ready
                        </div>
                      </div>
                    ) : track.analysis_status === 'failed' ? (
                      <div className="px-3 py-1 rounded-full bg-red-500/10 text-red-500 text-xs font-medium border border-red-500/20">
                        Failed
                      </div>
                    ) : (
                      <div className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-medium border border-blue-500/20 flex items-center">
                        <div className="w-2 h-2 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mr-2" />
                        Processing
                      </div>
                    )}
                    
                    {/* Delete Button */}
                    {onRemoveTrack && (
                      <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => onRemoveTrack(track.id)}
                          className="text-gray-600 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-destructive"
                          aria-label={`Delete track ${track.original_filename}`}
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </div>

                {track.analysis_status === 'completed' && (
                  <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                    <span>Rhythm shape</span>
                    {track.bpm && (
                      <span className="flex items-center gap-1 text-primary/80">
                        {track.bpm} BPM
                        {track.musical_key && <span className="text-gray-500">•</span>}
                        {track.musical_key}
                        {(track.bpm_confidence != null || track.key_confidence != null) && (
                          <>
                            <span className="text-gray-500">•</span>
                            <span className="text-[11px] text-gray-400">
                              conf {Math.round(Math.max(track.bpm_confidence ?? 0, track.key_confidence ?? 0) * 100)}%
                            </span>
                          </>
                        )}
                      </span>
                    )}
                  </div>
                )}
                {track.analysis_status === 'completed' && <Waveform beatGrid={track.beat_grid} waveformLite={track.waveform_lite} />}
                {/* Section structure tags */}
                {track.analysis_status === 'completed' && track.structure && track.structure.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {track.structure.slice(0, 6).map((section, idx) => {
                      const colorMap: Record<string, string> = {
                        'vocal-dominant': 'bg-pink-500/20 text-pink-300 border-pink-500/30',
                        'percussive': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
                        'build': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
                        'drop-like': 'bg-red-500/20 text-red-300 border-red-500/30',
                        'ambient': 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
                      };
                      const style = colorMap[section.label] ?? 'bg-gray-500/20 text-gray-300 border-gray-500/30';
                      const durationSec = Math.round(section.end - section.start);
                      return (
                        <span
                          key={idx}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${style}`}
                          title={`${section.start.toFixed(1)}s – ${section.end.toFixed(1)}s (confidence: ${Math.round(section.confidence * 100)}%)`}
                        >
                          {section.label} ({durationSec}s)
                        </span>
                      );
                    })}
                  </div>
                )}
                {track.analysis_status === 'completed' && track.drop_moments && track.drop_moments.length > 0 && (
                  <div className="mt-2 text-[11px] text-primary/80">Drops near {track.drop_moments.slice(0, 3).map((t) => `${Math.round(t)}s`).join(', ')}</div>
                )}

                {/* Stem Player - shown when stems are ready */}
                {track.has_stems && (
                  <StemPlayer 
                    trackId={track.id} 
                    trackName={track.original_filename}
                  />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
