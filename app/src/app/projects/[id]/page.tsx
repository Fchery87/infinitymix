'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Project, uploadedTracks } from '@/lib/db/schema';
import { ArrowLeft, Settings, Music, Disc3, Layers, Loader2, Upload, Plus, Sparkles, GripVertical, X, Check, Clock, Palette } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Navigation } from '@/components/navigation';
import { StemPlayer } from '@/components/stem-player';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type Tab = 'tracks' | 'stems' | 'mashups';

interface Track {
  id: string;
  name: string;
  bpm: number | null;
  key: string | null;
  durationSeconds: number | null;
  createdAt: Date;
}

interface Mashup {
  id: string;
  name: string;
  generationStatus: string;
  targetDurationSeconds: number | null;
  createdAt: Date;
}

interface Stem {
  id: string;
  stemType: 'vocals' | 'drums' | 'bass' | 'other';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  quality: string;
  engine: string | null;
  playUrl?: string;
}

const statusColors = {
  idea: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  in_progress: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  completed: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  archived: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
};

const statusLabels = {
  idea: 'Idea',
  in_progress: 'In Progress',
  completed: 'Completed',
  archived: 'Archived',
};

const KEY_OPTIONS = ['', 'C', 'C#/Db', 'D', 'D#/Eb', 'E', 'F', 'F#/Gb', 'G', 'G#/Ab', 'A', 'A#/Bb', 'B'];
const KEY_MODES = ['major', 'minor'];
const COLOR_OPTIONS = [
  '#f97316', '#ef4444', '#dc2626', '#ea580c',
  '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d947ef', '#ec4899',
];

interface TrackWithStems extends Track {
  stems?: Stem[];
}

export default function ProjectWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = (params?.id as string) ?? '';

  const [project, setProject] = useState<Project | null>(null);
  const [tracks, setTracks] = useState<TrackWithStems[]>([]);
  const [mashups, setMashups] = useState<Mashup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('tracks');
  
  // Settings modal state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    name: '',
    description: '',
    color: '#f97316',
    bpmLock: '',
    keyLock: '',
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Drag and drop state
  const [draggedTrackId, setDraggedTrackId] = useState<string | null>(null);
  const [dragOverTrackId, setDragOverTrackId] = useState<string | null>(null);

  useEffect(() => {
    fetchProject();
  }, [projectId]);

  useEffect(() => {
    if (project) {
      fetchTabData();
    }
  }, [activeTab, project]);

  const fetchProject = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/projects/${projectId}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Project not found');
        }
        throw new Error('Failed to fetch project');
      }

      const data = await response.json();
      setProject(data.project);
      setSettingsForm({
        name: data.project.name || '',
        description: data.project.description || '',
        color: data.project.color || '#f97316',
        bpmLock: data.project.bpmLock?.toString() || '',
        keyLock: data.project.keyLock || '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTabData = async () => {
    try {
      setIsLoadingData(true);

      if (activeTab === 'tracks') {
        const response = await fetch(`/api/projects/${projectId}/tracks`);
        if (response.ok) {
          const data = await response.json();
          setTracks(data.tracks || []);
        }
      } else if (activeTab === 'stems') {
        const response = await fetch(`/api/projects/${projectId}/tracks`);
        if (response.ok) {
          const data = await response.json();
          const tracksWithStems = (data.tracks || []) as TrackWithStems[];
          setTracks(tracksWithStems);
        }
      } else if (activeTab === 'mashups') {
        const response = await fetch(`/api/projects/${projectId}/mashups`);
        if (response.ok) {
          const data = await response.json();
          setMashups(data.mashups || []);
        }
      }
    } catch (err) {
      console.error('Error fetching tab data:', err);
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: settingsForm.name,
          description: settingsForm.description || null,
          color: settingsForm.color,
          bpmLock: settingsForm.bpmLock ? parseInt(settingsForm.bpmLock) : null,
          keyLock: settingsForm.keyLock || null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setProject(data.project);
        setIsSettingsOpen(false);
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleUploadTracks = () => {
    router.push(`/create?projectId=${projectId}&context=upload`);
  };

  const handleCreateMashup = () => {
    router.push(`/create?projectId=${projectId}&context=mashup`);
  };

  const handleDragStart = (trackId: string) => {
    setDraggedTrackId(trackId);
  };

  const handleDragOver = (e: React.DragEvent, trackId: string) => {
    e.preventDefault();
    if (draggedTrackId && draggedTrackId !== trackId) {
      setDragOverTrackId(trackId);
    }
  };

  const handleDrop = (targetTrackId: string) => {
    if (!draggedTrackId || draggedTrackId === targetTrackId) {
      setDraggedTrackId(null);
      setDragOverTrackId(null);
      return;
    }

    const draggedIndex = tracks.findIndex(t => t.id === draggedTrackId);
    const targetIndex = tracks.findIndex(t => t.id === targetTrackId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newTracks = [...tracks];
    const [draggedTrack] = newTracks.splice(draggedIndex, 1);
    newTracks.splice(targetIndex, 0, draggedTrack);

    setTracks(newTracks);
    setDraggedTrackId(null);
    setDragOverTrackId(null);
  };

  const handleDragEnd = () => {
    setDraggedTrackId(null);
    setDragOverTrackId(null);
  };

  const totalDuration = tracks.reduce((acc, track) => acc + (track.durationSeconds || 0), 0);

  if (isLoading) {
    return (
      <div className="relative min-h-screen overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-black" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-primary/15 rounded-full blur-[120px] opacity-20 pointer-events-none" />
        
        <div className="relative z-10 flex min-h-screen items-center justify-center">
          <div className="text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="mx-auto mb-6 w-fit"
            >
              <Loader2 className="h-16 w-16 text-primary" />
            </motion.div>
            <p className="text-lg text-gray-400">Loading project workspace...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="relative min-h-screen overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-black" />
        
        <div className="relative z-10 flex min-h-screen items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-md"
          >
            <div className="mx-auto w-fit rounded-full bg-red-500/20 p-6 mb-6">
              <Sparkles className="h-12 w-12 text-red-400" />
            </div>
            <h2 className="mb-3 text-2xl font-bold text-white">
              {error || 'Project not found'}
            </h2>
            <p className="mb-8 text-gray-400">
              The project you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.
            </p>
            <Link
              href="/projects"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-orange-500 px-8 py-4 font-semibold text-white shadow-lg shadow-primary/30 transition-all hover:shadow-primary/50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Projects
            </Link>
          </motion.div>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: typeof Music; count?: number }[] = [
    { id: 'tracks', label: 'Tracks', icon: Music, count: tracks.length },
    { id: 'stems', label: 'Stems', icon: Layers },
    { id: 'mashups', label: 'Mashups', icon: Disc3, count: mashups.length },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-black" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-primary/15 rounded-full blur-[120px] opacity-20 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[400px] bg-blue-600/10 rounded-full blur-[100px] opacity-15 pointer-events-none" />

      {/* Navbar */}
      <Navigation />

      <main className="pt-32 pb-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <Link
            href="/projects"
            className="mb-6 inline-flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Projects
          </Link>

          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/8 via-white/3 to-white/[0.02] backdrop-blur-md p-6 lg:p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="mb-3 flex items-center gap-3 flex-wrap">
                  <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight">
                    {project.name}
                  </h1>
                  <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusColors[project.status]}`}>
                    {statusLabels[project.status]}
                  </span>
                </div>
                {project.description && (
                  <p className="text-gray-400 mb-4">{project.description}</p>
                )}
                <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                  {project.bpmLock && (
                    <div className="flex items-center gap-1.5">
                      <Music className="h-4 w-4 text-primary/60" />
                      <span className="text-gray-400">{project.bpmLock} BPM</span>
                    </div>
                  )}
                  {project.keyLock && (
                    <div className="flex items-center gap-1.5">
                      <Disc3 className="h-4 w-4 text-primary/60" />
                      <span className="text-gray-400">{project.keyLock}</span>
                    </div>
                  )}
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsSettingsOpen(true)}
                className="rounded-xl p-3 bg-white/5 border border-white/10 text-gray-400 transition-all hover:bg-white/10 hover:text-white hover:border-white/20"
              >
                <Settings className="h-5 w-5" />
              </motion.button>
            </div>

            {/* Timeline View */}
            {tracks.length > 0 && (
              <div className="mt-6 pt-6 border-t border-white/10">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-4 w-4 text-primary/60" />
                  <span className="text-sm text-gray-400">Timeline</span>
                  <span className="text-xs text-gray-600">
                    {Math.floor(totalDuration / 60)}:{String(Math.floor(totalDuration % 60)).padStart(2, '0')} total
                  </span>
                </div>
                <div className="relative flex items-center gap-1 h-8">
                  {tracks.map((track, index) => (
                    <motion.div
                      key={track.id}
                      initial={{ opacity: 0, scaleX: 0 }}
                      animate={{ opacity: 1, scaleX: 1 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className="h-6 rounded-sm"
                      style={{
                        flex: track.durationSeconds || 1,
                        backgroundColor: settingsForm.color + '40',
                        minWidth: '20px',
                      }}
                      title={track.name}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-8 flex gap-2 border-b border-white/10 overflow-x-auto"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-6 py-3 font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-primary'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {tab.count !== undefined && (
                  <span className="ml-1 text-xs opacity-60">({tab.count})</span>
                )}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-orange-500"
                  />
                )}
              </button>
            );
          })}
        </motion.div>

        {/* Tab Content */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          {isLoadingData ? (
            <div className="flex items-center justify-center py-16">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              >
                <Loader2 className="h-12 w-12 text-primary" />
              </motion.div>
            </div>
          ) : (
            <>
              {activeTab === 'tracks' && (
                <>
                  {tracks.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-md p-12 text-center">
                      <div className="mx-auto w-fit rounded-full bg-primary/20 p-6 mb-6">
                        <Music className="h-12 w-12 text-primary" />
                      </div>
                      <h3 className="mb-3 text-2xl font-bold text-white">
                        No tracks yet
                      </h3>
                      <p className="mb-8 text-gray-400 max-w-md mx-auto">
                        Upload tracks to this project to get started with your creative workflow
                      </p>
                      <motion.button
                        whileHover={{ scale: 1.05, boxShadow: '0 0 40px rgba(249, 115, 22, 0.4)' }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleUploadTracks}
                        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-orange-500 px-8 py-4 font-semibold text-white shadow-lg shadow-primary/30 transition-all hover:shadow-primary/50"
                      >
                        <Upload className="h-5 w-5" />
                        Upload Tracks
                      </motion.button>
                    </div>
                  ) : (
                    <>
                      {/* Action buttons */}
                      <div className="flex flex-wrap gap-3 mb-6">
                        <motion.button
                          whileHover={{ scale: 1.05, boxShadow: '0 0 40px rgba(249, 115, 22, 0.4)' }}
                          whileTap={{ scale: 0.95 }}
                          onClick={handleUploadTracks}
                          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-orange-500 px-6 py-3 font-semibold text-white shadow-lg shadow-primary/30 transition-all hover:shadow-primary/50"
                        >
                          <Upload className="h-4 w-4" />
                          Upload Tracks
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={handleCreateMashup}
                          className="inline-flex items-center gap-2 rounded-xl bg-white/10 border border-white/20 px-6 py-3 font-semibold text-white transition-all hover:bg-white/20"
                        >
                          <Plus className="h-4 w-4" />
                          Create Mashup
                        </motion.button>
                      </div>
                      
                      {/* Tracks grid with drag-and-drop */}
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {tracks.map((track, index) => (
                          <motion.div
                            key={track.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: index * 0.05 }}
                            whileHover={{ scale: 1.03, y: -4 }}
                            draggable
                            onDragStart={() => handleDragStart(track.id)}
                            onDragOver={(e) => handleDragOver(e, track.id)}
                            onDrop={() => handleDrop(track.id)}
                            onDragEnd={handleDragEnd}
                            className={`group rounded-2xl border border-white/10 bg-gradient-to-br from-white/8 via-white/3 to-white/[0.02] backdrop-blur-md p-5 transition-all hover:border-primary/30 hover:shadow-xl hover:shadow-primary/20 cursor-move ${
                              dragOverTrackId === track.id ? 'border-primary scale-105' : ''
                            }`}
                          >
                            <div className="mb-3 flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <GripVertical className="h-4 w-4 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                <h4 className="font-semibold text-white line-clamp-1 group-hover:text-primary transition-colors">{track.name}</h4>
                              </div>
                            </div>
                            <div className="space-y-2 text-sm text-gray-400">
                              {track.bpm && (
                                <div className="flex items-center gap-1.5">
                                  <Music className="h-3.5 w-3.5 text-primary/60" />
                                  <span>{track.bpm} BPM</span>
                                </div>
                              )}
                              {track.key && (
                                <div className="flex items-center gap-1.5">
                                  <Disc3 className="h-3.5 w-3.5 text-primary/60" />
                                  <span>{track.key}</span>
                                </div>
                              )}
                              {track.durationSeconds && (
                                <p className="text-xs">
                                  {Math.floor(track.durationSeconds / 60)}:
                                  {String(Math.floor(track.durationSeconds % 60)).padStart(2, '0')}
                                </p>
                              )}
                              <p className="text-xs opacity-60">
                                {formatDistanceToNow(new Date(track.createdAt), { addSuffix: true })}
                              </p>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}

              {activeTab === 'stems' && (
                <>
                  {tracks.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-md p-12 text-center">
                      <div className="mx-auto w-fit rounded-full bg-primary/20 p-6 mb-6">
                        <Layers className="h-12 w-12 text-primary" />
                      </div>
                      <h3 className="mb-3 text-2xl font-bold text-white">
                        No stems yet
                      </h3>
                      <p className="text-gray-400">
                        Stems will appear here after processing your tracks
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {tracks.map((track) => (
                        <motion.div
                          key={track.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-md p-6"
                        >
                          <h3 className="text-lg font-semibold text-white mb-4">{track.name}</h3>
                          <StemPlayer trackId={track.id} trackName={track.name} />
                        </motion.div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {activeTab === 'mashups' && (
                <>
                  {mashups.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-md p-12 text-center">
                      <div className="mx-auto w-fit rounded-full bg-primary/20 p-6 mb-6">
                        <Disc3 className="h-12 w-12 text-primary" />
                      </div>
                      <h3 className="mb-3 text-2xl font-bold text-white">
                        No mashups yet
                      </h3>
                      <p className="mb-8 text-gray-400 max-w-md mx-auto">
                        Create mashups from your project tracks to bring your vision to life
                      </p>
                      <motion.button
                        whileHover={{ scale: 1.05, boxShadow: '0 0 40px rgba(249, 115, 22, 0.4)' }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleCreateMashup}
                        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-orange-500 px-8 py-4 font-semibold text-white shadow-lg shadow-primary/30 transition-all hover:shadow-primary/50"
                      >
                        <Plus className="h-5 w-5" />
                        Create Mashup
                      </motion.button>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {mashups.map((mashup, index) => (
                        <motion.div
                          key={mashup.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4, delay: index * 0.05 }}
                          whileHover={{ scale: 1.03, y: -4 }}
                          className="group rounded-2xl border border-white/10 bg-gradient-to-br from-white/8 via-white/3 to-white/[0.02] backdrop-blur-md p-5 transition-all hover:border-primary/30 hover:shadow-xl hover:shadow-primary/20"
                        >
                          <div className="mb-3 flex items-start justify-between">
                            <h4 className="font-semibold text-white line-clamp-1 group-hover:text-primary transition-colors">{mashup.name}</h4>
                          </div>
                          <div className="space-y-2 text-sm text-gray-400">
                            <p>Status: <span className="text-primary">{mashup.generationStatus}</span></p>
                            {mashup.targetDurationSeconds && (
                              <p>
                                Duration: {Math.floor(mashup.targetDurationSeconds / 60)}:
                                {String(Math.floor(mashup.targetDurationSeconds % 60)).padStart(2, '0')}
                              </p>
                            )}
                            <p className="text-xs opacity-60">
                              {formatDistanceToNow(new Date(mashup.createdAt), { addSuffix: true })}
                            </p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </motion.div>
      </main>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div 
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setIsSettingsOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg rounded-2xl border border-white/20 bg-[#1a1a1a] p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Project Settings</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsSettingsOpen(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="space-y-5">
                {/* Name */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">Project Name</label>
                  <Input
                    value={settingsForm.name}
                    onChange={(e) => setSettingsForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="My Awesome Project"
                    className="bg-black/30"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">Description</label>
                  <textarea
                    value={settingsForm.description}
                    onChange={(e) => setSettingsForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe your project..."
                    rows={3}
                    className="flex w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-sm text-white placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary resize-none"
                  />
                </div>

                {/* Color picker */}
                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-300">
                    <Palette className="h-4 w-4" />
                    Color Theme
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_OPTIONS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setSettingsForm(prev => ({ ...prev, color }))}
                        className={`h-8 w-8 rounded-full transition-all ${
                          settingsForm.color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-[#1a1a1a] scale-110' : 'hover:scale-110'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                {/* BPM Lock */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">BPM Lock (optional)</label>
                  <Input
                    type="number"
                    value={settingsForm.bpmLock}
                    onChange={(e) => setSettingsForm(prev => ({ ...prev, bpmLock: e.target.value }))}
                    placeholder="120"
                    min={1}
                    max={300}
                    className="bg-black/30"
                  />
                </div>

                {/* Key Lock */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">Key Lock (optional)</label>
                  <div className="flex gap-2">
                    <select
                      value={settingsForm.keyLock.split(' ')[0] || ''}
                      onChange={(e) => setSettingsForm(prev => ({ ...prev, keyLock: e.target.value + (prev.keyLock.split(' ')[1] ? ' ' + prev.keyLock.split(' ')[1] : '') }))}
                      className="flex h-12 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-sm text-white"
                    >
                      <option value="">Select root</option>
                      {KEY_OPTIONS.map((key) => (
                        <option key={key} value={key}>{key || 'None'}</option>
                      ))}
                    </select>
                    <select
                      value={settingsForm.keyLock.split(' ')[1] || 'major'}
                      onChange={(e) => setSettingsForm(prev => ({ ...prev, keyLock: (prev.keyLock.split(' ')[0] || '') + ' ' + e.target.value }))}
                      className="flex h-12 w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-sm text-white"
                    >
                      {KEY_MODES.map((mode) => (
                        <option key={mode} value={mode}>{mode}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-8 flex gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setIsSettingsOpen(false)}
                  className="flex-1 border border-white/10 text-gray-300 hover:bg-white/5"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveSettings}
                  disabled={isSavingSettings}
                  className="flex-1 bg-gradient-to-r from-primary to-orange-500 text-white"
                >
                  {isSavingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 mr-2" /> Save Changes</>}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}