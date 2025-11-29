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
  created_at: string;
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
                transition={{ delay: index * 0.1 }}
                className="group flex items-center justify-between p-4 bg-card/40 hover:bg-card/60 border border-white/5 hover:border-primary/20 rounded-xl backdrop-blur-sm transition-all duration-200"
              >
                <div className="flex items-center space-x-4 flex-1">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-black/40 border border-white/5 ${
                    track.analysis_status === 'completed' ? 'text-primary' : 'text-gray-500'
                  }`}>
                    <FileAudio className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-medium text-white group-hover:text-primary transition-colors">
                      {track.original_filename}
                    </p>
                    <div className="flex items-center space-x-3 text-sm text-gray-500 mt-1">
                      <span className="flex items-center">
                         {track.analysis_status === 'completed' ? (
                           <>
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-2" />
                            {track.bpm} BPM
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
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
