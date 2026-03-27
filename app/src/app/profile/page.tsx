'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Music, Heart, Play, Settings, Loader2, AlertCircle } from 'lucide-react';
import { Navigation } from '@/components/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import Link from 'next/link';

type UserProfile = {
  id: string;
  email: string;
  name: string;
  username: string | null;
  image: string | null;
  createdAt: string;
};

type UserStats = {
  totalMashups: number;
  publicMashups: number;
  totalPlays: number;
};

type RecentMashup = {
  id: string;
  name: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  created_at: string;
  playback_count: number;
};

function getRelativeTime(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  return then.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function ProfilePage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [recentMashups, setRecentMashups] = useState<RecentMashup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfileData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [profileRes, statsRes, mashupsRes] = await Promise.all([
        fetch('/api/users/me', { cache: 'no-store' }),
        fetch('/api/users/me/stats', { cache: 'no-store' }),
        fetch('/api/mashups?limit=3', { cache: 'no-store' }),
      ]);

      if (!profileRes.ok) {
        throw new Error('Failed to load profile');
      }

      const profileData = await profileRes.json();
      setProfile(profileData);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (mashupsRes.ok) {
        const mashupsData = await mashupsRes.json();
        setRecentMashups(mashupsData.data || []);
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      void fetchProfileData();
    } else if (!authLoading && !isAuthenticated) {
      setLoading(false);
    }
  }, [authLoading, isAuthenticated, fetchProfileData]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen font-sans text-foreground bg-background">
        <Navigation />
        <main className="pt-32 pb-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen font-sans text-foreground bg-background">
        <Navigation />
        <main className="pt-32 pb-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Sign in to view your profile</h1>
          <Link href="/login">
            <Button>Sign In</Button>
          </Link>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen font-sans text-foreground bg-background">
        <Navigation />
        <main className="pt-32 pb-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
          <p className="text-gray-400 mb-4">{error}</p>
          <Button onClick={() => void fetchProfileData()}>Try Again</Button>
        </main>
      </div>
    );
  }

  if (!profile) return null;

  const joinDate = new Date(profile.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen font-sans text-foreground bg-background">
        <Navigation />

        <main className="pt-32 pb-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
            {/* Profile Header */}
            <div className="flex flex-col md:flex-row items-center md:items-start gap-8 mb-12">
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-gray-800 to-black border-4 border-white/10 flex items-center justify-center shadow-2xl overflow-hidden">
                    {profile.image ? (
                        <img src={profile.image} alt={profile.name} className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-4xl font-bold text-gray-400">{getInitials(profile.name)}</span>
                    )}
                </div>
                <div className="flex-1 text-center md:text-left space-y-2">
                    <h1 className="text-4xl font-bold text-white">{profile.name}</h1>
                    <p className="text-gray-400">
                        {profile.username ? `@${profile.username}` : profile.email} • Member since {joinDate}
                    </p>
                    <div className="flex items-center justify-center md:justify-start gap-4 pt-2">
                        <Button variant="outline" size="sm" className="gap-2">
                            <Settings className="w-4 h-4" />
                            Edit Profile
                        </Button>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
                    <CardContent className="flex flex-col items-center justify-center p-6">
                        <Music className="w-8 h-8 text-primary mb-3" />
                        <span className="text-3xl font-bold text-white">{stats?.totalMashups ?? 0}</span>
                        <span className="text-sm text-gray-500">Mashups Created</span>
                    </CardContent>
                </Card>
                <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
                    <CardContent className="flex flex-col items-center justify-center p-6">
                        <Heart className="w-8 h-8 text-red-500 mb-3" />
                        <span className="text-3xl font-bold text-white">{stats?.publicMashups ?? 0}</span>
                        <span className="text-sm text-gray-500">Public Mashups</span>
                    </CardContent>
                </Card>
                <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
                    <CardContent className="flex flex-col items-center justify-center p-6">
                        <Play className="w-8 h-8 text-blue-500 mb-3" />
                        <span className="text-3xl font-bold text-white">{stats?.totalPlays ?? 0}</span>
                        <span className="text-sm text-gray-500">Total Plays</span>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Activity / Mashups */}
            <div>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-white">Recent Activity</h2>
                    <Link href="/mashups">
                        <Button variant="link" className="text-primary">View All</Button>
                    </Link>
                </div>
                {recentMashups.length === 0 ? (
                    <Card className="bg-card/20 border-white/5">
                        <CardContent className="p-8 text-center">
                            <Music className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                            <p className="text-gray-400">No mashups yet. Create your first mashup!</p>
                            <Link href="/create">
                                <Button className="mt-4">Create Mashup</Button>
                            </Link>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {recentMashups.map((mashup) => (
                            <Card key={mashup.id} className="bg-card/20 border-white/5 hover:bg-card/40 transition-colors">
                                <CardContent className="p-4 flex items-center gap-4">
                                    <div className="w-12 h-12 rounded bg-primary/10 flex items-center justify-center text-primary">
                                        <Music className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-medium text-white">{mashup.name}</h3>
                                        <p className="text-sm text-gray-500">Created {getRelativeTime(mashup.created_at)}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {mashup.playback_count > 0 && (
                                            <span className="text-xs text-gray-400 flex items-center gap-1">
                                                <Play className="w-3 h-3" />
                                                {mashup.playback_count}
                                            </span>
                                        )}
                                        <span
                                            className={`text-xs px-2 py-1 rounded border ${
                                                mashup.status === 'completed'
                                                    ? 'bg-green-500/10 text-green-500 border-green-500/20'
                                                    : mashup.status === 'generating'
                                                    ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                                                    : mashup.status === 'failed'
                                                    ? 'bg-red-500/10 text-red-500 border-red-500/20'
                                                    : 'bg-gray-500/10 text-gray-500 border-gray-500/20'
                                            }`}
                                        >
                                            {mashup.status === 'completed' ? 'Completed' : mashup.status === 'generating' ? 'Generating' : mashup.status === 'failed' ? 'Failed' : 'Pending'}
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </main>
    </div>
  );
}
