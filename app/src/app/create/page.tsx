'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { FileUpload } from '@/components/file-upload';
import { TrackList, Track } from '@/components/track-list';
import { DurationPicker, DurationPreset } from '@/components/duration-picker';

export default function CreatePage() {
  const [isAuthenticated] = useState(true); // Auto-logged in for development
  const [uploadedTracks, setUploadedTracks] = useState<Track[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [durationPreset, setDurationPreset] = useState<DurationPreset>('2_minutes');
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const [generationMessage, setGenerationMessage] = useState<string | null>(null);

  const loadTracks = useCallback(async () => {
    try {
      setIsLoadingTracks(true);
      const response = await fetch('/api/audio/pool', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Failed to load tracks');
      }
      const data: Track[] = await response.json();
      setUploadedTracks(data);
      setSelectedTrackIds((current) => current.filter((id) => data.some((track) => track.id === id && track.analysis_status === 'completed')));
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingTracks(false);
    }
  }, []);

  useEffect(() => {
    void loadTracks();
  }, [loadTracks]);

  useEffect(() => {
    const shouldPoll = uploadedTracks.some((track) => track.analysis_status === 'pending' || track.analysis_status === 'analyzing');
    if (!shouldPoll) return;

    const interval = setInterval(() => {
      void loadTracks();
    }, 3000);

    return () => clearInterval(interval);
  }, [uploadedTracks, loadTracks]);

  const handleFileUpload = (files: FileList) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);

    const upload = async () => {
      try {
        const formData = new FormData();
        Array.from(files).forEach((file) => formData.append('files', file));
        const response = await fetch('/api/audio/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json().catch(() => null);
          throw new Error(error?.error || 'Upload failed');
        }

        await loadTracks();
      } catch (error) {
        console.error(error);
        alert(error instanceof Error ? error.message : 'Upload failed');
      } finally {
        setIsUploading(false);
      }
    };

    void upload();
  };

  const handleRemoveTrack = (id: string) => {
    const remove = async () => {
      try {
        const response = await fetch(`/api/audio/pool/${id}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('Failed to delete track');
        }

        setSelectedTrackIds((current) => current.filter((trackId) => trackId !== id));
        await loadTracks();
      } catch (error) {
        console.error(error);
        alert(error instanceof Error ? error.message : 'Failed to delete track');
      }
    };

    void remove();
  };

  const handleGenerateMashup = async () => {
    if (selectedTrackIds.length < 2) {
      alert('Select at least 2 analyzed tracks');
      return;
    }

    setIsGenerating(true);
    setGenerationMessage(null);

    try {
      const response = await fetch('/api/mashups/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputFileIds: selectedTrackIds,
          durationPreset,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to start mashup generation');
      }

      setGenerationMessage('Mashup request accepted and processing. You can check My Mashups for output once ready.');
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Failed to start mashup generation');
    } finally {
      setIsGenerating(false);
    }
  };

  const completedTracks = useMemo(() => uploadedTracks.filter((t) => t.analysis_status === 'completed'), [uploadedTracks]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Redirecting to login...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans text-foreground relative">
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
              <Link href="/mashups">
                <Button variant="ghost" className="text-gray-400 hover:text-white hover:bg-white/5">My Mashups</Button>
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
      <main className="pt-32 pb-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-4">
            Unleash Your <span className="text-primary glow-text">Sonic Creativity</span>
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Drag, drop, and let our AI engine fuse your tracks into a masterpiece.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-12 gap-8">
          
          {/* Upload Zone (Left/Top) */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="lg:col-span-7 space-y-6"
          >
            <FileUpload 
                onUpload={handleFileUpload} 
                isUploading={isUploading} 
            />
            {isLoadingTracks && (
              <p className="text-sm text-gray-500">Refreshing tracks...</p>
            )}
          </motion.div>

          {/* Controls & Generation (Right/Bottom) */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="lg:col-span-5 space-y-6"
          >
            {/* Settings using reusable DurationPicker */}
            <DurationPicker 
                value={durationPreset} 
                onChange={setDurationPreset} 
            />

            <Card className="bg-card/60 backdrop-blur-xl">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-400">Select analyzed tracks</p>
                  <span className="text-xs text-gray-500">{completedTracks.length} ready</span>
                </div>
                <div className="space-y-3 max-h-48 overflow-auto pr-1">
                  {completedTracks.length === 0 && (
                    <p className="text-sm text-gray-500">No completed tracks yet. Upload files and wait for analysis.</p>
                  )}
                  {completedTracks.map((track) => (
                    <label key={track.id} className="flex items-center justify-between p-3 rounded-lg bg-black/20 border border-white/5 hover:border-primary/30 transition-colors cursor-pointer">
                      <div>
                        <p className="text-sm text-white">{track.original_filename}</p>
                        <p className="text-xs text-gray-500">{track.bpm ? `${track.bpm} BPM` : 'BPM TBD'} {track.musical_key ? `• ${track.musical_key}` : ''}</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={selectedTrackIds.includes(track.id)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSelectedTrackIds((current) => {
                            if (checked) return [...new Set([...current, track.id])];
                            return current.filter((id) => id !== track.id);
                          });
                        }}
                        className="h-5 w-5 accent-primary"
                      />
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            {/* Generation Action */}
            <Card className="bg-card/60 backdrop-blur-xl">
                <CardContent className="pt-6">
                    <Button 
                        className="w-full h-14 text-lg font-bold relative overflow-hidden group" 
                        variant="default"
                        onClick={handleGenerateMashup}
                        disabled={isGenerating || selectedTrackIds.length < 2}
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-primary via-orange-400 to-primary opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <span className="relative z-10 flex items-center justify-center">
                        {isGenerating ? (
                            <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-3" />
                            Processing...
                            </>
                        ) : (
                            <>
                            <Zap className="w-5 h-5 mr-2 fill-white" />
                            Generate Mashup
                            </>
                        )}
                        </span>
                    </Button>
                    {selectedTrackIds.length < 2 && (
                        <p className="text-xs text-center mt-3 text-gray-500">
                        * Requires at least 2 analyzed tracks
                        </p>
                    )}
                    {generationMessage && (
                      <p className="text-xs text-center mt-3 text-green-500">{generationMessage}</p>
                    )}
                </CardContent>
            </Card>

            {/* Mini Status */}
            <Card className="bg-black/20 border-white/5">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="text-sm text-gray-400">Engine Status</div>
                <div className="flex items-center text-sm text-green-500">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
                  Online & Ready
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Track List using reusable component */}
        <TrackList 
            tracks={uploadedTracks} 
            onRemoveTrack={handleRemoveTrack} 
        />
        
      </main>
    </div>
  );
}
