'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Music, Play, Download, Trash2, AlertCircle, Zap, FileAudio, Sparkles } from 'lucide-react';
import { formatDuration, getStatusText } from '@/lib/utils/helpers';
import { motion, AnimatePresence } from 'framer-motion';
import { AudioPlayer } from '@/components/audio-player';
import { SatisfactionSurvey } from '@/components/satisfaction-survey';
import Link from 'next/link';

type Mashup = {
  id: string;
  name: string;
  duration_seconds: number;
  status: 'pending' | 'queued' | 'generating' | 'completed' | 'failed';
  output_path: string | null;
  output_format: string | null;
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
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [surveyMashupId, setSurveyMashupId] = useState<string | null>(null);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [submittedFeedback, setSubmittedFeedback] = useState<Record<string, boolean>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchMashups = useCallback(async (skipLoader = false) => {
    try {
      if (!skipLoader) setLoading(true);
      setErrorMessage(null);
      const response = await fetch('/api/mashups?limit=25', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to load mashups');
      }

      const items = (payload.data || payload.mashups || []) as Mashup[];
      setMashups(items);
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load mashups');
    } finally {
      if (!skipLoader) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMashups();
  }, [fetchMashups]);

  useEffect(() => {
    const needsPolling = mashups.some((m) => m.status !== 'completed' && m.status !== 'failed');
    if (!needsPolling) return;

    const interval = setInterval(() => {
      void fetchMashups(true);
    }, 4000);

    return () => clearInterval(interval);
  }, [mashups, fetchMashups]);

  useEffect(() => {
    if (surveyMashupId) return;
    const nextCandidate = mashups.find((m) => m.status === 'completed' && !submittedFeedback[m.id]);
    if (nextCandidate) {
      setSurveyMashupId(nextCandidate.id);
    }
  }, [mashups, surveyMashupId, submittedFeedback]);

  const stats = useMemo(() => {
    const completed = mashups.filter((m) => m.status === 'completed');
    const inProgress = mashups.filter((m) => m.status !== 'completed' && m.status !== 'failed');
    const totalDuration = completed.reduce((acc, m) => acc + (m.duration_seconds || 0), 0);
    const plays = mashups.reduce((acc, m) => acc + (m.playback_count || 0), 0);
    const downloads = mashups.reduce((acc, m) => acc + (m.download_count || 0), 0);
    return { completed: completed.length, inProgress: inProgress.length, totalDuration, plays, downloads };
  }, [mashups]);

  const currentMashup = useMemo(
    () => mashups.find((m) => m.id === playingMashupId) || null,
    [mashups, playingMashupId]
  );

  const audioSource = useMemo(() => {
    if (!currentMashup || !currentMashup.output_path) return null;
    return `/api/mashups/${currentMashup.id}/download?stream=true`;
  }, [currentMashup]);

  const handlePlay = async (mashupId: string) => {
    const mashup = mashups.find((m) => m.id === mashupId);
    if (!mashup || mashup.status !== 'completed' || !mashup.output_path) {
      alert('Mashup is not ready for playback yet.');
      return;
    }

    if (playingMashupId === mashupId) {
      setIsPlaying((prev) => !prev);
    } else {
      setPlayingMashupId(mashupId);
      setIsPlaying(true);
    }

    try {
      await fetch(`/api/mashups/${mashupId}/play`, { method: 'POST' });
      void fetchMashups(true);
    } catch (error) {
      console.error(error);
    }
  };

  const handleDownload = async (mashupId: string) => {
    const mashup = mashups.find((m) => m.id === mashupId);
    if (!mashup || mashup.status !== 'completed' || !mashup.output_path) {
      alert('Mashup is not ready for download yet.');
      return;
    }

    try {
      setDownloadingId(mashupId);
      const response = await fetch(`/api/mashups/${mashupId}/download`);
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Failed to download mashup');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${mashup.name}.${mashup.output_format || 'wav'}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      void fetchMashups(true);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Failed to download mashup');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (mashupId: string) => {
    if (!confirm('Are you sure you want to delete this mashup?')) return;
    try {
      setDeletingId(mashupId);
      const response = await fetch(`/api/mashups/${mashupId}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Failed to delete mashup');
      }
      setMashups((prev) => prev.filter((m) => m.id !== mashupId));
      if (playingMashupId === mashupId) {
        setPlayingMashupId(null);
        setIsPlaying(false);
      }
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Failed to delete mashup');
    } finally {
      setDeletingId(null);
    }
  };

  const handleFeedbackSubmit = async (rating: number, feedback: string) => {
    if (!surveyMashupId || feedbackSubmitting) return;
    try {
      setFeedbackSubmitting(true);
      const response = await fetch(`/api/mashups/${surveyMashupId}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rating, comments: feedback }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Failed to submit feedback');
      }

      setSubmittedFeedback((prev) => ({ ...prev, [surveyMashupId]: true }));
      setSurveyMashupId(null);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Failed to submit feedback');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

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

        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-card/50 border-white/5">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-400 text-sm">Completed</span>
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div className="text-3xl font-bold text-white">{stats.completed}</div>
              <p className="text-xs text-gray-500 mt-1">Ready for playback & download</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-white/5">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-400 text-sm">In Progress</span>
                <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
              </div>
              <div className="text-3xl font-bold text-white">{stats.inProgress}</div>
              <p className="text-xs text-gray-500 mt-1">Queued, pending, or generating</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-white/5">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-400 text-sm">Engagement</span>
                <Music className="w-4 h-4 text-primary" />
              </div>
              <div className="text-lg font-semibold text-white">{stats.plays} plays • {stats.downloads} downloads</div>
              <p className="text-xs text-gray-500 mt-1">Avg length {stats.completed ? formatDuration(Math.max(1, Math.floor(stats.totalDuration / stats.completed))) : '—'}</p>
            </CardContent>
          </Card>
        </div>

        {errorMessage && (
          <Card className="bg-destructive/10 border-red-500/30 mb-6">
            <CardContent className="p-4 text-red-200 text-sm">{errorMessage}</CardContent>
          </Card>
        )}

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
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="bg-card/40 border-white/5 hover:border-primary/20 hover:bg-card/60 transition-all duration-300 backdrop-blur-md group">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between gap-4">
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
                              <span className="px-2 py-0.5 rounded text-xs font-medium bg-white/5 text-gray-400 border border-white/5">
                                {getStatusText(mashup.status)}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                              <span>{new Date(mashup.created_at).toLocaleString()}</span>
                              <span className="w-1 h-1 rounded-full bg-gray-700" />
                              <span>{mashup.playback_count} Plays</span>
                              <span className="w-1 h-1 rounded-full bg-gray-700" />
                              <span>{mashup.download_count} Downloads</span>
                              {mashup.generation_time_ms && (
                                <>
                                  <span className="w-1 h-1 rounded-full bg-gray-700" />
                                  <span>{(mashup.generation_time_ms / 1000).toFixed(1)}s render</span>
                                </>
                              )}
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
                                disabled={downloadingId === mashup.id}
                                className="border-white/10 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                              >
                                {downloadingId === mashup.id ? (
                                  <div className="flex items-center">
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                                    Preparing
                                  </div>
                                ) : (
                                  <>
                                    <Download className="w-4 h-4 mr-2" />
                                    Download
                                  </>
                                )}
                              </Button>
                              {!submittedFeedback[mashup.id] && (
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => setSurveyMashupId(mashup.id)}
                                  className="text-gray-300 hover:text-primary"
                                >
                                  <Sparkles className="w-4 h-4 mr-2" />
                                  Rate
                                </Button>
                              )}
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
                            disabled={mashup.status === 'generating' || deletingId === mashup.id}
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

        {surveyMashupId && (
          <div className="mt-10">
            <SatisfactionSurvey onSubmit={handleFeedbackSubmit} className="max-w-3xl mx-auto" />
            {feedbackSubmitting && <p className="text-center text-sm text-gray-400 mt-2">Submitting feedback...</p>}
          </div>
        )}

        <AnimatePresence>
          {currentMashup && (
            <AudioPlayer
              trackName={currentMashup.name}
              duration={currentMashup.duration_seconds}
              isPlaying={isPlaying}
              src={audioSource}
              onClose={() => {
                setPlayingMashupId(null);
                setIsPlaying(false);
              }}
              onTogglePlay={() => setIsPlaying(!isPlaying)}
              onEnded={() => setIsPlaying(false)}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
