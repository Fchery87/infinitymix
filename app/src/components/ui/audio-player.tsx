'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward, Volume2, X, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDuration } from '@/lib/utils/helpers';

interface AudioPlayerProps {
  trackName: string;
  duration: number;
  isPlaying: boolean;
  onClose: () => void;
  onTogglePlay: () => void;
}

export function AudioPlayer({ trackName, duration, isPlaying, onClose, onTogglePlay }: AudioPlayerProps) {
  const [progress, setProgress] = React.useState(0);
  const [volume, setVolume] = React.useState(80);

  // Simulate progress when playing
  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) return 0;
          return prev + 0.5; // Simulate playback speed
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const currentTime = (progress / 100) * duration;

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 pt-2"
    >
      <div className="max-w-5xl mx-auto">
        <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden group">
          {/* Background Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-full bg-primary/5 blur-3xl pointer-events-none" />

          <div className="flex items-center gap-6 relative z-10">
            
            {/* Track Info */}
            <div className="flex items-center gap-4 w-1/4 min-w-[200px]">
              <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-gray-800 to-black border border-white/10 flex items-center justify-center relative overflow-hidden">
                <motion.div 
                  animate={{ rotate: isPlaying ? 360 : 0 }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 bg-[conic-gradient(from_0deg,transparent_0_340deg,white_360deg)] opacity-20"
                />
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                   <div className="w-3 h-3 bg-primary rounded-full animate-pulse" />
                </div>
              </div>
              <div className="overflow-hidden">
                <h4 className="font-bold text-white truncate">{trackName}</h4>
                <p className="text-xs text-gray-400">InfinityMix AI Generated</p>
              </div>
            </div>

            {/* Controls & Progress */}
            <div className="flex-1 flex flex-col items-center gap-2">
              <div className="flex items-center gap-4">
                <button className="text-gray-400 hover:text-white transition-colors">
                  <SkipBack className="w-5 h-5" />
                </button>
                <button 
                  onClick={onTogglePlay}
                  className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform active:scale-95"
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 fill-current" />
                  ) : (
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  )}
                </button>
                <button className="text-gray-400 hover:text-white transition-colors">
                  <SkipForward className="w-5 h-5" />
                </button>
              </div>
              
              <div className="w-full flex items-center gap-3 text-xs text-gray-400 font-medium">
                <span className="w-10 text-right">{formatDuration(currentTime)}</span>
                <div className="flex-1 h-1.5 bg-white/10 rounded-full relative cursor-pointer group/progress overflow-hidden">
                  <motion.div 
                    className="absolute top-0 left-0 h-full bg-primary rounded-full"
                    style={{ width: `${progress}%` }}
                  />
                  <div className="absolute top-0 left-0 h-full w-full opacity-0 group-hover/progress:opacity-100 transition-opacity">
                    <div className="w-2 h-2 bg-white rounded-full absolute top-1/2 -translate-y-1/2 -ml-1 shadow-lg" style={{ left: `${progress}%` }} />
                  </div>
                </div>
                <span className="w-10">{formatDuration(duration)}</span>
              </div>
            </div>

            {/* Volume & Actions */}
            <div className="flex items-center gap-4 w-1/4 justify-end">
               <div className="flex items-center gap-2 group/vol">
                 <Volume2 className="w-5 h-5 text-gray-400" />
                 <div className="w-20 h-1 bg-white/10 rounded-full relative cursor-pointer">
                   <div className="absolute top-0 left-0 h-full bg-white/50 rounded-full" style={{ width: `${volume}%` }} />
                 </div>
               </div>
               <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                 <X className="w-5 h-5 text-gray-400" />
               </button>
            </div>

          </div>
          
          {/* Visualizer Mock */}
          <div className="absolute bottom-0 left-0 right-0 h-1/3 flex items-end justify-between gap-1 px-4 opacity-10 pointer-events-none">
             {[...Array(60)].map((_, i) => (
               <motion.div
                 key={i}
                 className="w-full bg-primary rounded-t-sm"
                 animate={{ 
                   height: isPlaying ? [`${Math.random() * 100}%`, `${Math.random() * 50}%`] : "10%" 
                 }}
                 transition={{
                   duration: 0.2,
                   repeat: Infinity,
                   repeatType: "reverse",
                   delay: i * 0.01
                 }}
               />
             ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
