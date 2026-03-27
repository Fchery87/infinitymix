'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { AudioPlayer } from '@/components/audio-player';
import { Button } from '@/components/ui/button';
import { ShortcutFeedback } from '@/components/ui/shortcut-feedback';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts';
import Link from 'next/link';
import { ArrowLeft, Plus, FolderKanban, Music, User, AlertCircle, Loader2 } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils/helpers';

type MashupStatus = {
  id: string;
  name: string;
  duration_seconds: number | null;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  output_path: string | null;
  playback_path: string | null;
  playback_count: number;
  download_count: number;
  input_tracks: Array<{
    id: string;
    originalFilename: string;
    bpm: string | null;
    keySignature: string | null;
  }>;
};

export default function PlayerPage() {
  const searchParams = useSearchParams();
  const mashupId = searchParams?.get('mashupId') ?? null;
  const router = useRouter();

  const [mashup, setMashup] = useState<MashupStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);

  // Shortcut feedback state
  const [feedback, setFeedback] = useState<{ label: string; icon?: string } | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showFeedback = useCallback((label: string, icon?: string) => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    setFeedback({ label, icon });
    feedbackTimer.current = setTimeout(() => setFeedback(null), 800);
  }, []);

  const fetchMashup = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/mashups/${id}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to load mashup');
      }

      setMashup(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load mashup');
      setMashup(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handlePlay = useCallback(async () => {
    if (!mashupId) return;
    setIsPlaying((prev) => !prev);
    try {
      await fetch(`/api/mashups/${mashupId}/play`, { method: 'POST' });
    } catch {
      // Non-critical — playback count increment failed silently
    }
  }, [mashupId]);

  const handleAudioRef = useCallback((audio: HTMLAudioElement | null) => {
    audioRef.current = audio;
  }, []);

  useEffect(() => {
    if (mashupId) {
      void fetchMashup(mashupId);
    } else {
      setMashup(null);
      setError(null);
      setLoading(false);
    }
  }, [mashupId, fetchMashup]);

  const audioSource = useMemo(() => {
    if (!mashup || mashup.status !== 'completed' || !mashup.output_path) return null;
    return `/api/mashups/${mashup.id}/download?stream=true`;
  }, [mashup]);

  // Player keyboard shortcuts
  useKeyboardShortcuts(
    useMemo(() => {
      if (!mashupId || mashup?.status !== 'completed') return [];

      return [
        {
          key: ' ',
          preventDefault: true,
          callback: () => {
            handlePlay();
            showFeedback(isPlaying ? 'Pause' : 'Play', isPlaying ? 'pause' : 'play');
          },
        },
        {
          key: 'ArrowLeft',
          callback: () => {
            if (audioRef.current) {
              audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
              showFeedback('-10s', 'seek-back');
            }
          },
        },
        {
          key: 'ArrowRight',
          callback: () => {
            if (audioRef.current) {
              const maxTime = audioRef.current.duration || 0;
              audioRef.current.currentTime = Math.min(maxTime, audioRef.current.currentTime + 10);
              showFeedback('+10s', 'seek-forward');
            }
          },
        },
        {
          key: 'm',
          callback: () => {
            if (audioRef.current) {
              audioRef.current.muted = !audioRef.current.muted;
              setIsMuted(audioRef.current.muted);
              showFeedback(audioRef.current.muted ? 'Muted' : 'Unmuted', audioRef.current.muted ? 'mute' : 'unmute');
            }
          },
        },
        {
          key: 'f',
          callback: async () => {
            const el = playerContainerRef.current;
            if (!el) return;
            try {
              if (document.fullscreenElement) {
                await document.exitFullscreen();
                showFeedback('Exit Fullscreen', 'fullscreen');
              } else {
                await el.requestFullscreen();
                showFeedback('Fullscreen', 'fullscreen');
              }
            } catch {
              // Fullscreen not supported or denied
            }
          },
        },
      ];
    }, [mashupId, mashup?.status, isPlaying, showFeedback, handlePlay])
  );

  // Global shortcuts
  useGlobalShortcuts(
    useMemo(() => ({
      onNewMashup: () => router.push('/create'),
    }), [router])
  );

  if (!mashupId) {
    return <EmptyState />;
  }

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (!mashup) {
    return <EmptyState />;
  }

  if (mashup.status !== 'completed') {
    return <NotReadyState mashup={mashup} />;
  }

  return (
    <div ref={playerContainerRef} className="min-h-screen bg-black text-white flex flex-col relative overflow-hidden">
      {/* Visualizer Background */}
      <div className="absolute inset-0 flex items-end justify-center opacity-20 pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="w-full mx-1 bg-primary animate-pulse"
            style={{
              height: `${Math.random() * 60 + 20}%`,
              animationDuration: `${Math.random() * 1 + 0.5}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 p-8">
        <Link href="/mashups">
          <Button variant="ghost" className="text-gray-400 hover:text-white">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Library
          </Button>
        </Link>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center relative z-10">
        <div className="w-64 h-64 md:w-96 md:h-96 rounded-2xl bg-gradient-to-br from-gray-800 to-black border border-white/10 shadow-2xl flex items-center justify-center mb-12 relative overflow-hidden group">
          <div className="absolute inset-0 bg-[conic-gradient(from_0deg,transparent_0_340deg,white_360deg)] opacity-10 group-hover:opacity-20 transition-opacity animate-[spin_4s_linear_infinite]" />
          <div className="w-32 h-32 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
            <div className="w-16 h-16 rounded-full bg-primary blur-xl" />
          </div>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold text-center mb-2">{mashup.name}</h1>
        <p className="text-xl text-gray-400 mb-2">
          InfinityMix AI{mashup.input_tracks.length > 0 && ` • ${mashup.input_tracks.length} tracks`}
        </p>
        <p className="text-sm text-gray-500">
          {mashup.playback_count} plays • {mashup.download_count} downloads
        </p>
      </div>

      {/* Player Component */}
      <div className="relative z-50">
        <AudioPlayer
          trackName={mashup.name}
          duration={mashup.duration_seconds ?? 0}
          isPlaying={isPlaying}
          src={audioSource}
          onClose={() => {
            setIsPlaying(false);
          }}
          onTogglePlay={handlePlay}
          onEnded={() => setIsPlaying(false)}
          onAudioRef={handleAudioRef}
        />
      </div>

      {/* Shortcut Feedback */}
      {feedback && (
        <ShortcutFeedback
          label={feedback.label}
          icon={feedback.icon}
          visible={!!feedback}
        />
      )}

      {/* Bottom Navigation */}
      <PlayerNavigation />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center relative overflow-hidden">
      <div className="relative z-10 text-center max-w-md px-6">
        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
          <Music className="w-10 h-10 text-gray-500" />
        </div>
        <h1 className="text-2xl font-bold mb-2">No mashup selected</h1>
        <p className="text-gray-400 mb-8">
          Select a mashup from your library to start playing.
        </p>
        <Link href="/mashups">
          <Button variant="glow" size="lg">
            Browse Mashups
          </Button>
        </Link>
      </div>
      <PlayerNavigation />
    </div>
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-gray-400">Loading mashup...</p>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center relative overflow-hidden">
      <div className="relative z-10 text-center max-w-md px-6">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-10 h-10 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Could not load mashup</h1>
        <p className="text-gray-400 mb-8">{message}</p>
        <Link href="/mashups">
          <Button variant="glow" size="lg">
            Back to Library
          </Button>
        </Link>
      </div>
      <PlayerNavigation />
    </div>
  );
}

function NotReadyState({ mashup }: { mashup: MashupStatus }) {
  const statusLabel =
    mashup.status === 'generating'
      ? 'Generating...'
      : mashup.status === 'pending'
        ? 'Pending'
        : 'Failed';

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center relative overflow-hidden">
      <div className="relative z-10 text-center max-w-md px-6">
        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
          {mashup.status === 'failed' ? (
            <AlertCircle className="w-10 h-10 text-red-400" />
          ) : (
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
          )}
        </div>
        <h1 className="text-2xl font-bold mb-2">{mashup.name}</h1>
        <p className="text-gray-400 mb-2">
          Status: <span className={mashup.status === 'failed' ? 'text-red-400' : 'text-primary'}>{statusLabel}</span>
        </p>
        <p className="text-sm text-gray-500 mb-8">
          {mashup.status === 'failed'
            ? 'This mashup generation failed. Try creating a new one.'
            : 'Audio is not ready yet. This page will update once generation completes.'}
        </p>
        <Link href="/mashups">
          <Button variant="glow" size="lg">
            Back to Library
          </Button>
        </Link>
      </div>
      <PlayerNavigation />
    </div>
  );
}

function PlayerNavigation() {
  const pathname = usePathname();

  const navItems = [
    { href: '/create', label: 'Create', icon: Plus },
    { href: '/projects', label: 'Projects', icon: FolderKanban },
    { href: '/mashups', label: 'Mashups', icon: Music },
    { href: '/profile', label: 'Profile', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-lg border-t border-white/5 z-50">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href === '/mashups' && pathname === '/player');
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg transition-all duration-200',
                isActive
                  ? 'text-primary'
                  : 'text-gray-400 hover:text-white'
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{item.label}</span>
              {isActive && (
                <span className="absolute bottom-1 w-1 h-1 bg-primary rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
