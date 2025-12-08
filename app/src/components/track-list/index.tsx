'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { FileAudio, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/helpers';

export interface Track {
  id: string;
  original_filename: string;
  analysis_status: 'pending' | 'analyzing' | 'completed' | 'failed';
  bpm: number | null;
  musical_key: string | null;
  camelot_key?: string | null;
  beat_grid?: number[];
   waveform_lite?: number[];
   drop_moments?: number[];
   structure?: Array<{ label: string; start: number; end: number; confidence: number }>;
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
  className?: string;
}

export function TrackList({ tracks, onRemoveTrack, className }: TrackListProps) {
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

                  <div className="flex items-center space-x-4">
                    {track.analysis_status === 'completed' ? (
                      <div className="px-3 py-1 rounded-full bg-green-500/10 text-green-500 text-xs font-medium border border-green-500/20">
                        Ready
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
                    {onRemoveTrack && (
                      <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => onRemoveTrack(track.id)}
                          className="text-gray-600 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4" />
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
                      </span>
                    )}
                  </div>
                )}
                {track.analysis_status === 'completed' && <Waveform beatGrid={track.beat_grid} waveformLite={track.waveform_lite} />}
                {track.analysis_status === 'completed' && track.drop_moments && track.drop_moments.length > 0 && (
                  <div className="mt-2 text-[11px] text-primary/80">Drops near {track.drop_moments.slice(0, 3).map((t) => `${Math.round(t)}s`).join(', ')}</div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
