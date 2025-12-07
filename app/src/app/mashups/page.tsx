'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Music, Play, Download, Trash2, AlertCircle, Zap, FileAudio } from 'lucide-react';
import { formatDuration, getStatusText } from '@/lib/utils/helpers';
import { motion, AnimatePresence } from 'framer-motion';
import { AudioPlayer } from '@/components/audio-player';
import Link from 'next/link';

type Mashup = {
  id: string;
  name: string;
  duration_seconds: number;
  status: 'pending' | 'queued' | 'generating' | 'completed' | 'failed';
  output_path: string | null;
  generation_time_ms: number | null;
  playback_count: number;
  download_count: number;
  created_at: string;
};

export default function MashupsPage() {
  const [mashups, setMashups] = useState<Mashup[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingMashupId, setPlayingMashupId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    // Load mock data for development
    const mockMashups: Mashup[] = [
      {
        id: 'mock-mashup-1',
        name: 'Midnight City x Levels (Epic Mix)',
        duration_seconds: 120,
        status: 'completed',
        output_path: 'mock-url-1.mp3',
        generation_time_ms: 45000,
        playback_count: 5,
        download_count: 2,
        created_at: new Date('2024-01-15T10:30:00Z').toISOString(),
      },
      {
        id: 'mock-mashup-2',
        name: 'Summer Vibes vs. Deep House',
        duration_seconds: 180,
        status: 'completed',
        output_path: 'mock-url-2.mp3',
        generation_time_ms: 67000,
        playback_count: 12,
        download_count: 4,
        created_at: new Date('2024-01-14T15:45:00Z').toISOString(),
      },
    ];
    
    setTimeout(() => {
      setMashups(mockMashups);
      setLoading(false);
    }, 1000);
  }, []);

  const handlePlay = (mashupId: string) => {
    if (playingMashupId === mashupId) {
      setIsPlaying(!isPlaying);
    } else {
      setPlayingMashupId(mashupId);
      setIsPlaying(true);
    }
  };

  const handleDownload = async (mashupId: string) => {
    const mashup = mashups.find(m => m.id === mashupId);
    if (!mashup) return;
    alert(`🎵 Downloading "${mashup.name}" - ${formatDuration(mashup.duration_seconds)} mashup`);
  };

  const handleDelete = async (mashupId: string) => {
    if (!confirm('Are you sure you want to delete this mashup?')) return;
    setMashups(prev => prev.filter(m => m.id !== mashupId));
    if (playingMashupId === mashupId) {
      setPlayingMashupId(null);
      setIsPlaying(false);
    }
  };

  const currentMashup = mashups.find(m => m.id === playingMashupId);

  return (
    <div className="min-h-screen font-sans text-foreground relative pb-32">
      {/* Navbar */}
      <header className="fixed top-0 w-full z-50 border-b border-white/5 bg-background/60 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <Link href="/create">
              <div className="flex items-center group cursor-pointer">
                <div className="w-10 h-10 bg-gradient-to-tr from-primary to-orange-600 rounded-xl flex items-center justify-center mr-3 shadow-lg group-hover:shadow-primary/50 transition-all duration-300">
                  <Zap className="w-6 h-6 text-white fill-white" />
                </div>
                <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 group-hover:to-white transition-all">InfinityMix</h1>
              </div>
            </Link>
            <nav className="flex items-center space-x-6">
              <Link href="/create">
                <Button variant="ghost" className="text-gray-400 hover:text-white hover:bg-white/5">Create New</Button>
              </Link>
              <Link href="/profile">
                <Button variant="ghost" className="text-gray-400 hover:text-white hover:bg-white/5">Profile</Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" className="border-white/10 hover:bg-white/5 hover:text-white">Sign Out</Button>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-32 pb-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-white mb-2">Your Sonic Library</h1>
          <p className="text-gray-400">
            All your AI-generated masterpieces in one place.
          </p>
        </motion.div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-card/20 rounded-xl animate-pulse border border-white/5" />
            ))}
          </div>
        ) : mashups.length === 0 ? (
          <Card className="bg-card/40 border-dashed border-white/10">
            <CardContent className="text-center py-16">
              <div className="w-20 h-20 bg-black/40 rounded-full flex items-center justify-center mx-auto mb-6">
                <Music className="w-10 h-10 text-gray-500" />
              </div>
              <h3 className="text-xl font-medium text-white mb-2">No mashups yet</h3>
              <p className="text-gray-500 mb-8">
                Create your first mashup to see it here
              </p>
              <Link href="/create">
                <Button variant="glow" size="lg">Create Your First Mashup</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <motion.div 
            className="space-y-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <AnimatePresence>
              {mashups.map((mashup, index) => (
                <motion.div
                  key={mashup.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="bg-card/40 border-white/5 hover:border-primary/20 hover:bg-card/60 transition-all duration-300 backdrop-blur-md group">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-5 flex-1">
                          <div className={`w-12 h-12 rounded-lg flex items-center justify-center bg-black/40 border border-white/5 ${
                            mashup.status === 'completed' ? 'text-primary' : 'text-gray-500'
                          }`}>
                            <FileAudio className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="flex items-center space-x-3 mb-1">
                              <h3 className="font-bold text-lg text-white group-hover:text-primary transition-colors">{mashup.name}</h3>
                              <span className="px-2 py-0.5 rounded text-xs font-medium bg-white/5 text-gray-400 border border-white/5">
                                {formatDuration(mashup.duration_seconds)}
                              </span>
                            </div>
                            <div className="flex items-center space-x-4 text-sm text-gray-500">
                              <span>{new Date(mashup.created_at).toLocaleDateString()}</span>
                              <span className="w-1 h-1 rounded-full bg-gray-700" />
                              <span>{mashup.download_count} Downloads</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          {mashup.status === 'completed' ? (
                            <>
                              <Button 
                                variant={playingMashupId === mashup.id ? "default" : "outline"}
                                size="sm" 
                                className={`border-white/10 hover:bg-primary/10 hover:text-primary hover:border-primary/30 ${
                                  playingMashupId === mashup.id ? "bg-primary text-primary-foreground border-primary" : ""
                                }`}
                                onClick={() => handlePlay(mashup.id)}
                              >
                                {playingMashupId === mashup.id && isPlaying ? (
                                  <div className="flex items-center">
                                    <div className="flex space-x-0.5 mr-2 h-3 items-end">
                                      <motion.div animate={{ height: [4, 12, 6] }} transition={{ repeat: Infinity, duration: 0.5 }} className="w-0.5 bg-current rounded-full" />
                                      <motion.div animate={{ height: [8, 4, 10] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-0.5 bg-current rounded-full" />
                                      <motion.div animate={{ height: [6, 10, 4] }} transition={{ repeat: Infinity, duration: 0.7 }} className="w-0.5 bg-current rounded-full" />
                                    </div>
                                    Playing
                                  </div>
                                ) : (
                                  <>
                                    <Play className="w-4 h-4 mr-2" />
                                    Play
                                  </>
                                )}
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleDownload(mashup.id)}
                                className="border-white/10 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                              >
                                <Download className="w-4 h-4 mr-2" />
                                Download
                              </Button>
                            </>
                          ) : mashup.status === 'failed' ? (
                            <div className="flex items-center text-red-500 px-4">
                              <AlertCircle className="w-4 h-4 mr-2" />
                              Failed
                            </div>
                          ) : (
                            <div className="flex items-center text-primary px-4">
                              <div className="w-4 h-4 border-2 border-t-primary border-primary/30 rounded-full animate-spin mr-2" />
                              {getStatusText(mashup.status)}
                            </div>
                          )}
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleDelete(mashup.id)}
                            disabled={mashup.status === 'generating'}
                            className="text-gray-600 hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        <AnimatePresence>
          {currentMashup && (
            <AudioPlayer
              trackName={currentMashup.name}
              duration={currentMashup.duration_seconds}
              isPlaying={isPlaying}
              onClose={() => {
                setPlayingMashupId(null);
                setIsPlaying(false);
              }}
              onTogglePlay={() => setIsPlaying(!isPlaying)}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
