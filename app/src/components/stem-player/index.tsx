'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Download, Volume2, VolumeX, ChevronDown, ChevronUp, Mic2, Drum, Guitar, Music, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getPublicAudioPipelineFeatureFlags } from '@/lib/audio/feature-flags';
import {
  buildTransitionAutomationPlan,
  createPreviewGraph,
  type PreviewGraph,
  type PreviewGraphCapabilities,
  type PreviewTransitionStyle,
} from '@/lib/audio/preview-graph';
import { recordPreviewQaTelemetry } from '@/lib/audio/preview-qa-telemetry';
import { cn } from '@/lib/utils/helpers';

export interface Stem {
  id: string;
  stemType: 'vocals' | 'drums' | 'bass' | 'other';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  quality: string;
  engine: string | null;
  playUrl?: string;
}

interface StemPlayerProps {
  trackId: string;
  trackName: string;
  className?: string;
}

const STEM_CONFIG: Record<string, { icon: typeof Mic2; color: string; label: string }> = {
  vocals: { icon: Mic2, color: 'text-pink-400 bg-pink-500/10 border-pink-500/20', label: 'Vocals' },
  drums: { icon: Drum, color: 'text-orange-400 bg-orange-500/10 border-orange-500/20', label: 'Drums' },
  bass: { icon: Guitar, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20', label: 'Bass' },
  other: { icon: Music, color: 'text-green-400 bg-green-500/10 border-green-500/20', label: 'Other' },
};

const TRANSITION_PREVIEW_STYLE_OPTIONS: Array<{ value: PreviewTransitionStyle; label: string }> = [
  { value: 'smooth', label: 'Smooth' },
  { value: 'energy', label: 'Energy' },
  { value: 'drop', label: 'Drop' },
  { value: 'filter_sweep', label: 'Filter Sweep' },
  { value: 'echo_reverb', label: 'Echo + Reverb' },
  { value: 'tape_stop', label: 'Tape Stop' },
];

function StemTrack({ stem, isPlaying, onTogglePlay, onDownload }: { 
  stem: Stem; 
  isPlaying: boolean;
  onTogglePlay: () => void;
  onDownload: () => void;
}) {
  const config = STEM_CONFIG[stem.stemType] || STEM_CONFIG.other;
  const Icon = config.icon;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!stem.playUrl) return;
    
    if (!audioRef.current) {
      audioRef.current = new Audio(stem.playUrl);
      audioRef.current.addEventListener('timeupdate', () => {
        if (audioRef.current) {
          setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100 || 0);
        }
      });
      audioRef.current.addEventListener('ended', () => {
        setProgress(0);
      });
    }

    if (isPlaying) {
      audioRef.current.play().catch(console.error);
    } else {
      audioRef.current.pause();
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [isPlaying, stem.playUrl]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const toggleMute = () => setIsMuted(!isMuted);

  if (stem.status !== 'completed' || !stem.playUrl) {
    return (
      <div className={cn('flex items-center gap-3 p-3 rounded-lg border opacity-50', config.color)}>
        <Icon className="w-4 h-4" />
        <span className="text-sm font-medium flex-1">{config.label}</span>
        <span className="text-xs opacity-60">
          {stem.status === 'processing' ? 'Processing...' : stem.status === 'failed' ? 'Failed' : 'Pending'}
        </span>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-3 p-3 rounded-lg border transition-all', config.color)}>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-full"
        onClick={onTogglePlay}
        aria-label={isPlaying ? "Pause stem" : "Play stem"}
      >
        {isPlaying ? <Pause className="w-4 h-4" aria-hidden="true" /> : <Play className="w-4 h-4" aria-hidden="true" />}
      </Button>

      <Icon className="w-4 h-4" />
      <span className="text-sm font-medium">{config.label}</span>

      {/* Progress bar */}
      <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
        <div 
          className="h-full bg-current transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Volume control */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={toggleMute}
          aria-label={isMuted ? "Unmute stem" : "Mute stem"}
        >
          {isMuted ? <VolumeX className="w-3 h-3" aria-hidden="true" /> : <Volume2 className="w-3 h-3" aria-hidden="true" />}
        </Button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="w-12 h-1 accent-current opacity-60 hover:opacity-100"
        />
      </div>

      {/* Download button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={onDownload}
        aria-label="Download stem"
      >
        <Download className="w-3 h-3" aria-hidden="true" />
      </Button>

      {/* Engine badge */}
      {stem.engine && (
        <span className="text-[10px] opacity-50 uppercase">{stem.engine}</span>
      )}
    </div>
  );
}

export function StemPlayer({ trackId, trackName, className }: StemPlayerProps) {
  const audioFeatureFlags = getPublicAudioPipelineFeatureFlags();
  const [isExpanded, setIsExpanded] = useState(false);
  const [stems, setStems] = useState<Stem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [playingStems, setPlayingStems] = useState<Set<string>>(new Set());
  const [previewTransitionStyle, setPreviewTransitionStyle] = useState<PreviewTransitionStyle>('smooth');
  const [isTransitionPreviewing, setIsTransitionPreviewing] = useState(false);
  const [previewGraphCapabilities, setPreviewGraphCapabilities] = useState<PreviewGraphCapabilities | null>(null);
  const [previewGraphError, setPreviewGraphError] = useState<string | null>(null);
  const previewGraphRef = useRef<PreviewGraph | null>(null);
  const previewUiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopTransitionPreviewUiTimer = () => {
    if (previewUiTimerRef.current) {
      clearTimeout(previewUiTimerRef.current);
      previewUiTimerRef.current = null;
    }
  };

  const stopTransitionPreview = () => {
    stopTransitionPreviewUiTimer();
    previewGraphRef.current?.stopPlayback();
    setIsTransitionPreviewing(false);
  };

  const getTransitionPreviewSources = () => {
    const completed = stems.filter((stem) => stem.status === 'completed' && stem.playUrl);
    const vocalStem = completed.find((stem) => stem.stemType === 'vocals');
    const instrumentalStem =
      completed.find((stem) => stem.stemType === 'other') ??
      completed.find((stem) => stem.stemType === 'drums') ??
      completed.find((stem) => stem.stemType === 'bass');

    if (!vocalStem?.playUrl || !instrumentalStem?.playUrl) {
      return null;
    }

    return {
      vocalStem,
      instrumentalStem,
      vocalUrl: vocalStem.playUrl,
      instrumentalUrl: instrumentalStem.playUrl,
    };
  };

  const ensurePreviewGraph = async () => {
    if (previewGraphRef.current) {
      return previewGraphRef.current;
    }

    const graph = await createPreviewGraph();
    previewGraphRef.current = graph;
    setPreviewGraphCapabilities(graph.capabilities);
    if (!graph.capabilities.available) {
      setPreviewGraphError(graph.capabilities.reason ?? 'Browser preview graph unavailable');
      recordPreviewQaTelemetry('capability_unavailable', graph.capabilities.reason);
    } else {
      setPreviewGraphError(null);
      recordPreviewQaTelemetry('capability_probe', 'stem_player');
    }
    return graph;
  };

  const loadStems = async () => {
    if (stems.length > 0) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/audio/stems/${trackId}`);
      if (response.ok) {
        const data = await response.json();
        setStems(data.stems || []);
      }
    } catch (error) {
      console.error('Failed to load stems:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleExpand = () => {
    if (!isExpanded) {
      loadStems();
    } else {
      // Stop all playing stems when collapsing
      setPlayingStems(new Set());
      stopTransitionPreview();
    }
    setIsExpanded(!isExpanded);
  };

  const handleTogglePlay = (stemId: string) => {
    stopTransitionPreview();
    setPlayingStems(prev => {
      const next = new Set(prev);
      if (next.has(stemId)) {
        next.delete(stemId);
      } else {
        next.add(stemId);
      }
      return next;
    });
  };

  const handleDownload = async (stem: Stem) => {
    if (!stem.playUrl) return;
    
    try {
      const response = await fetch(stem.playUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${trackName.replace(/\.[^/.]+$/, '')}_${stem.stemType}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const handlePlayAll = () => {
    stopTransitionPreview();
    const completedStems = stems.filter(s => s.status === 'completed' && s.playUrl);
    if (playingStems.size > 0) {
      setPlayingStems(new Set());
    } else {
      setPlayingStems(new Set(completedStems.map(s => s.id)));
    }
  };

  const handlePreviewTransition = async () => {
    const sources = getTransitionPreviewSources();
    if (!sources) {
      setPreviewGraphError('Transition preview requires vocals plus one instrumental stem');
      return;
    }

    setPreviewGraphError(null);
    setPlayingStems(new Set());

    try {
      const graph = await ensurePreviewGraph();
      if (!graph.capabilities.available) {
        setPreviewGraphError(graph.capabilities.reason ?? 'Browser preview graph unavailable');
        recordPreviewQaTelemetry('capability_unavailable', graph.capabilities.reason);
        return;
      }

      await graph.loadPlayers({
        vocalUrl: sources.vocalUrl,
        instrumentalUrl: sources.instrumentalUrl,
      });
      graph.setMix({ vocalGain: 1, instrumentalGain: 1, wetFx: 0.25 });

      const plan = buildTransitionAutomationPlan(previewTransitionStyle, 4);
      setIsTransitionPreviewing(true);
      await graph.playTransitionPreview(plan);
      recordPreviewQaTelemetry('preview_started', `stem_player:${previewTransitionStyle}`);

      stopTransitionPreviewUiTimer();
      previewUiTimerRef.current = setTimeout(() => {
        setIsTransitionPreviewing(false);
      }, Math.ceil((plan.durationSeconds + 2) * 1000));
    } catch (error) {
      setIsTransitionPreviewing(false);
      setPreviewGraphError(error instanceof Error ? error.message : 'Failed to preview transition');
      recordPreviewQaTelemetry('preview_failed', error instanceof Error ? error.message : 'unknown');
    }
  };

  useEffect(() => {
    return () => {
      if (previewUiTimerRef.current) {
        clearTimeout(previewUiTimerRef.current);
        previewUiTimerRef.current = null;
      }
      previewGraphRef.current?.dispose();
      previewGraphRef.current = null;
    };
  }, []);

  const completedCount = stems.filter(s => s.status === 'completed').length;
  const isAllPlaying = playingStems.size > 0;
  const transitionPreviewSources = getTransitionPreviewSources();

  return (
    <div className={cn('mt-3', className)}>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleToggleExpand}
        className="w-full justify-between h-8 px-3 text-xs text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 border border-purple-500/20 rounded-lg"
      >
        <span className="flex items-center gap-2">
          <Music className="w-3 h-3" />
          {isExpanded ? 'Hide Stems' : 'View Stems'}
          {!isExpanded && completedCount > 0 && (
            <span className="text-[10px] opacity-60">({completedCount} ready)</span>
          )}
        </span>
        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </Button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-3 space-y-2">
              {isLoading ? (
                <div className="text-center py-4 text-sm text-gray-500">Loading stems...</div>
              ) : stems.length === 0 ? (
                <div className="text-center py-4 text-sm text-gray-500">No stems found</div>
              ) : (
                <>
                  {/* Play All / Stop All button */}
                  <div className="flex items-center justify-between gap-3 mb-2">
                    {audioFeatureFlags.toneJsPreviewGraph && (
                      <div className="flex-1 rounded-lg border border-purple-500/20 bg-purple-500/5 p-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] uppercase tracking-wide text-purple-300/80">
                            Tone.js Transition Preview
                          </span>
                          <select
                            value={previewTransitionStyle}
                            onChange={(e) => setPreviewTransitionStyle(e.target.value as PreviewTransitionStyle)}
                            className="h-7 rounded border border-white/10 bg-black/40 px-2 text-xs text-white"
                            disabled={isTransitionPreviewing}
                          >
                            {TRANSITION_PREVIEW_STYLE_OPTIONS.map((style) => (
                              <option key={style.value} value={style.value}>
                                {style.label}
                              </option>
                            ))}
                          </select>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={isTransitionPreviewing ? stopTransitionPreview : handlePreviewTransition}
                            className="h-7 px-3 text-xs border border-purple-500/30 hover:bg-purple-500/10"
                            disabled={!transitionPreviewSources && !isTransitionPreviewing}
                          >
                            {isTransitionPreviewing ? (
                              <>
                                <Pause className="w-3 h-3 mr-1" />
                                Stop FX Preview
                              </>
                            ) : (
                              <>
                                <Zap className="w-3 h-3 mr-1" />
                                Preview FX
                              </>
                            )}
                          </Button>
                        </div>
                        <p className="mt-1 text-[11px] text-gray-400">
                          {previewGraphError
                            ? previewGraphError
                            : transitionPreviewSources
                              ? `Uses ${STEM_CONFIG[transitionPreviewSources.vocalStem.stemType].label.toLowerCase()} + ${STEM_CONFIG[transitionPreviewSources.instrumentalStem.stemType].label.toLowerCase()} stems for browser-side FX auditioning.`
                              : 'Requires completed vocals and at least one instrumental stem (other/drums/bass).'}
                        </p>
                        {previewGraphCapabilities && !previewGraphCapabilities.available && previewGraphCapabilities.reason && (
                          <p className="mt-1 text-[11px] text-amber-300/80">
                            Fallback: {previewGraphCapabilities.reason}
                          </p>
                        )}
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handlePlayAll}
                      className="h-7 px-3 text-xs"
                    >
                      {isAllPlaying ? (
                        <>
                          <Pause className="w-3 h-3 mr-1" />
                          Stop All
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 mr-1" />
                          Play All
                        </>
                      )}
                    </Button>
                  </div>

                  {stems.map(stem => (
                    <StemTrack
                      key={stem.id}
                      stem={stem}
                      isPlaying={playingStems.has(stem.id)}
                      onTogglePlay={() => handleTogglePlay(stem.id)}
                      onDownload={() => handleDownload(stem)}
                    />
                  ))}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
