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
import { overallCompatibility } from '@/lib/utils/audio-compat';

export default function CreatePage() {
  const [isAuthenticated] = useState(true); // Auto-logged in for development
  const [uploadedTracks, setUploadedTracks] = useState<Track[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [durationPreset, setDurationPreset] = useState<DurationPreset>('2_minutes');
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const [generationMessage, setGenerationMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSmartMixing, setIsSmartMixing] = useState(false);

  const scoreStyles = (score: number) => {
    if (score >= 0.8) return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300';
    if (score >= 0.6) return 'bg-amber-500/10 border-amber-500/30 text-amber-200';
    return 'bg-red-500/10 border-red-500/30 text-red-200';
  };

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

  const handlePreview = async () => {
    if (selectedTrackIds.length < 2) {
      alert('Select at least 2 analyzed tracks to preview');
      return;
    }
    setIsPreviewing(true);
    setPreviewUrl(null);
    try {
      const res = await fetch('/api/mashups/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackIds: selectedTrackIds, durationSeconds: 20 }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Preview failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Failed to preview');
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleSmartMix = async () => {
    try {
      setIsSmartMixing(true);
      const res = await fetch('/api/mashups/recommendations', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error('Smart mix failed');
      }
      const data = await res.json();
      if (Array.isArray(data.track_ids) && data.track_ids.length >= 2) {
        setSelectedTrackIds(data.track_ids);
        setGenerationMessage('Smart mix selected your best combination');
      }
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Smart mix failed');
    } finally {
      setIsSmartMixing(false);
    }
  };

  const completedTracks = useMemo(() => uploadedTracks.filter((t) => t.analysis_status === 'completed'), [uploadedTracks]);

  const anchorTrack = useMemo(() => {
    if (selectedTrackIds.length === 0) return completedTracks[0] ?? null;
    return completedTracks.find((t) => selectedTrackIds.includes(t.id)) ?? completedTracks[0] ?? null;
  }, [completedTracks, selectedTrackIds]);

  const compatibilityHints = useMemo(() => {
    if (!anchorTrack) return [] as Array<{ id: string; name: string; score: number; bpmDiff: number | null; keyOk: boolean }>;
    return completedTracks
      .filter((t) => t.id !== anchorTrack.id)
      .map((t) => {
        const { score, bpmDiff, keyOk } = overallCompatibility(anchorTrack.bpm, anchorTrack.camelot_key ?? anchorTrack.musical_key, {
          bpm: t.bpm,
          camelotKey: t.camelot_key ?? t.musical_key,
        });
        return {
          id: t.id,
          name: t.original_filename,
          score,
          bpmDiff: bpmDiff ?? null,
          keyOk,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
  }, [anchorTrack, completedTracks]);

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

            {/* Preview + surprise me */}
            <Card className="bg-card/60 backdrop-blur-xl border-white/10">
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-400">Quick actions</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    disabled={isPreviewing || selectedTrackIds.length < 2}
                    onClick={handlePreview}
                    className="h-12 border-white/10 hover:border-primary/30 hover:text-primary"
                  >
                    {isPreviewing ? 'Rendering preview…' : 'Preview 20s'}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={handleSmartMix}
                    disabled={isSmartMixing}
                    className="h-12 text-primary hover:text-primary"
                  >
                    {isSmartMixing ? 'Selecting…' : 'Smart mix'}
                  </Button>
                </div>
                {previewUrl && (
                  <div className="rounded-lg border border-white/5 bg-black/30 p-3">
                    <p className="text-xs text-gray-400 mb-2">Preview (temporary)</p>
                    <audio controls src={previewUrl ?? undefined} className="w-full" />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Compatibility helper */}
            <Card className="bg-card/60 backdrop-blur-xl border-white/10">
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-400">Compatibility suggestions</p>
                  <span className="text-xs text-gray-500">Anchor: {anchorTrack ? anchorTrack.original_filename : '—'}</span>
                </div>
                {(!anchorTrack || compatibilityHints.length === 0) && (
                  <p className="text-sm text-gray-500">Select or upload analyzed tracks to see best pairings.</p>
                )}
                {compatibilityHints.length > 0 && (
                  <div className="space-y-2">
                    {compatibilityHints.map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-black/20 px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-sm text-white truncate">{item.name}</p>
                          <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                            <span className={`px-2 py-1 rounded-full text-[11px] font-medium ${scoreStyles(item.score)}`}>
                              Score {(item.score * 100).toFixed(0)}%
                            </span>
                            {item.bpmDiff !== null && <span className="text-gray-400">Δ {Math.round(item.bpmDiff)} BPM</span>}
                            <span className={item.keyOk ? 'text-emerald-300' : 'text-gray-500'}>{item.keyOk ? 'Key match' : 'Key stretch'}</span>
                          </div>
                        </div>
                        <div className="text-xs text-primary/80">Suggested</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

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
