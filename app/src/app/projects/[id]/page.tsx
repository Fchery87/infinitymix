'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Project } from '@/lib/db/schema';
import { ArrowLeft, Settings, Music, Disc3, Layers, Loader2, Upload, Plus, Sparkles, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
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

export default function ProjectWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [mashups, setMashups] = useState<Mashup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('tracks');

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTabData = async () => {
    if (activeTab === 'stems') return; // Stems not implemented yet

    try {
      setIsLoadingData(true);

      if (activeTab === 'tracks') {
        const response = await fetch(`/api/projects/${projectId}/tracks`);
        if (response.ok) {
          const data = await response.json();
          setTracks(data.tracks || []);
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
              The project you're looking for doesn't exist or you don't have access to it.
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
              <Link href="/projects">
                <Button variant="ghost" className="text-white">Projects</Button>
              </Link>
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
                className="rounded-xl p-3 bg-white/5 border border-white/10 text-gray-400 transition-all hover:bg-white/10 hover:text-white hover:border-white/20"
              >
                <Settings className="h-5 w-5" />
              </motion.button>
            </div>
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
                        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-orange-500 px-8 py-4 font-semibold text-white shadow-lg shadow-primary/30 transition-all hover:shadow-primary/50"
                      >
                        <Upload className="h-5 w-5" />
                        Upload Tracks
                      </motion.button>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {tracks.map((track, index) => (
                        <motion.div
                          key={track.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4, delay: index * 0.05 }}
                          whileHover={{ scale: 1.03, y: -4 }}
                          className="group rounded-2xl border border-white/10 bg-gradient-to-br from-white/8 via-white/3 to-white/[0.02] backdrop-blur-md p-5 transition-all hover:border-primary/30 hover:shadow-xl hover:shadow-primary/20"
                        >
                          <div className="mb-3 flex items-start justify-between">
                            <h4 className="font-semibold text-white line-clamp-1 group-hover:text-primary transition-colors">{track.name}</h4>
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
                  )}
                </>
              )}

              {activeTab === 'stems' && (
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
    </div>
  );
}
