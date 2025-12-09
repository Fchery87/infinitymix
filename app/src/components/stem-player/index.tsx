'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Download, Volume2, VolumeX, ChevronDown, ChevronUp, Mic2, Drum, Guitar, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
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
        >
          {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
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
      >
        <Download className="w-3 h-3" />
      </Button>

      {/* Engine badge */}
      {stem.engine && (
        <span className="text-[10px] opacity-50 uppercase">{stem.engine}</span>
      )}
    </div>
  );
}

export function StemPlayer({ trackId, trackName, className }: StemPlayerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [stems, setStems] = useState<Stem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [playingStems, setPlayingStems] = useState<Set<string>>(new Set());

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
    }
    setIsExpanded(!isExpanded);
  };

  const handleTogglePlay = (stemId: string) => {
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
    const completedStems = stems.filter(s => s.status === 'completed' && s.playUrl);
    if (playingStems.size > 0) {
      setPlayingStems(new Set());
    } else {
      setPlayingStems(new Set(completedStems.map(s => s.id)));
    }
  };

  const completedCount = stems.filter(s => s.status === 'completed').length;
  const isAllPlaying = playingStems.size > 0;

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
                  <div className="flex justify-end mb-2">
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
