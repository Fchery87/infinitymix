'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Users,
  Search,
  Shield,
  Ban,
  Key,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  Music,
  Layers,
  HardDrive,
  Clock,
  Mail,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

type UserRow = {
  id: string;
  email: string;
  name: string;
  username: string | null;
  createdAt: string;
  emailVerified: boolean;
  plan: {
    tier: 'free' | 'pro' | 'studio';
    quotaMinutesUsed: number;
    monthlyMinutes: number;
  };
  stats: {
    trackCount: number;
    mashupCount: number;
    storageBytes: number;
  };
  lastActiveAt: string | null;
  isSuspended: boolean;
};

type UsersResponse = {
  users: UserRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type SortField = 'created' | 'name' | 'email' | 'tracks' | 'mashups' | 'storage' | 'lastActive';
type FilterPlan = 'all' | 'free' | 'pro' | 'studio';

const tierColors: Record<string, string> = {
  free: 'bg-gray-500',
  pro: 'bg-blue-500',
  studio: 'bg-purple-500',
};

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function daysSince(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export default function AdminUsersPage() {
  const [data, setData] = useState<UsersResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('created');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [filterPlan, setFilterPlan] = useState<FilterPlan>('all');
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        sort: sortField,
        dir: sortDir,
      });
      if (search) params.set('search', search);
      if (filterPlan !== 'all') params.set('plan', filterPlan);

      const response = await fetch(`/api/admin/users?${params}`);
      if (!response.ok) throw new Error('Failed to load users');
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  }, [page, sortField, sortDir, search, filterPlan]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleSuspend = async (userId: string) => {
    if (!confirm('Are you sure you want to suspend this user?')) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}/suspend`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to suspend user');
      await loadUsers();
      if (selectedUser?.id === userId) {
        setSelectedUser({ ...selectedUser, isSuspended: true });
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to suspend');
    }
  };

  const handleUnsuspend = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/unsuspend`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to unsuspend user');
      await loadUsers();
      if (selectedUser?.id === userId) {
        setSelectedUser({ ...selectedUser, isSuspended: false });
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to unsuspend');
    }
  };

  const handleResetPassword = async (userId: string) => {
    if (!confirm('Send password reset email to this user?')) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}/reset-password`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to send reset');
      alert('Password reset email sent');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to send reset');
    }
  };

  const totalUsers = data?.pagination.total ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-white/5 bg-background/60 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href="/admin">
                <Button variant="ghost" size="sm">Back to Admin</Button>
              </Link>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Users className="w-5 h-5" /> User Management
              </h1>
            </div>
            <Badge variant="secondary">{totalUsers} users</Badge>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Users</p>
                  <p className="text-3xl font-bold">{totalUsers}</p>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <Users className="w-6 h-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Verified</p>
                  <p className="text-3xl font-bold text-green-500">
                    {data?.users.filter(u => u.emailVerified).length ?? 0}
                  </p>
                </div>
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Suspended</p>
                  <p className="text-3xl font-bold text-red-500">
                    {data?.users.filter(u => u.isSuspended).length ?? 0}
                  </p>
                </div>
                <div className="p-3 bg-red-500/10 rounded-lg">
                  <Ban className="w-6 h-6 text-red-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Pro & Studio</p>
                  <p className="text-3xl font-bold text-purple-500">
                    {data?.users.filter(u => u.plan.tier !== 'free').length ?? 0}
                  </p>
                </div>
                <div className="p-3 bg-purple-500/10 rounded-lg">
                  <Shield className="w-6 h-6 text-purple-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[240px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <Input
                    placeholder="Search by name or email..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    className="pl-10"
                  />
                </div>
              </div>
              <select
                value={filterPlan}
                onChange={(e) => { setFilterPlan(e.target.value as FilterPlan); setPage(1); }}
                className="h-12 rounded-lg border border-white/10 bg-black/20 px-4 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
              >
                <option value="all">All Plans</option>
                <option value="free">Free</option>
                <option value="pro">Pro</option>
                <option value="studio">Studio</option>
              </select>
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as SortField)}
                className="h-12 rounded-lg border border-white/10 bg-black/20 px-4 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
              >
                <option value="created">Created</option>
                <option value="name">Name</option>
                <option value="email">Email</option>
                <option value="tracks">Tracks</option>
                <option value="mashups">Mashups</option>
                <option value="storage">Storage</option>
                <option value="lastActive">Last Active</option>
              </select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
              >
                {sortDir === 'asc' ? 'A-Z' : 'Z-A'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Users List */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Users</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : error ? (
                  <div className="text-center py-12 text-red-500">
                    <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
                    <p>{error}</p>
                    <Button onClick={loadUsers} variant="outline" className="mt-4">Retry</Button>
                  </div>
                ) : !data || data.users.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No users found</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.users.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => setSelectedUser(user)}
                        className={`w-full text-left p-4 rounded-lg border transition-colors ${
                          selectedUser?.id === user.id
                            ? 'border-primary/50 bg-primary/5'
                            : 'border-white/10 bg-black/20 hover:bg-black/30'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{user.name}</span>
                              <Badge
                                variant="secondary"
                                className={`${tierColors[user.plan.tier]} text-white text-[10px] px-1.5`}
                              >
                                {user.plan.tier}
                              </Badge>
                              {user.isSuspended && (
                                <Badge variant="destructive" className="text-[10px] px-1.5">
                                  suspended
                                </Badge>
                              )}
                              {!user.emailVerified && (
                                <Badge variant="outline" className="text-[10px] px-1.5 text-yellow-500 border-yellow-500/30">
                                  unverified
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-500 truncate">{user.email}</p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-600">
                              <span className="flex items-center gap-1">
                                <Music className="w-3 h-3" /> {user.stats.trackCount}
                              </span>
                              <span className="flex items-center gap-1">
                                <Layers className="w-3 h-3" /> {user.stats.mashupCount}
                              </span>
                              <span className="flex items-center gap-1">
                                <HardDrive className="w-3 h-3" /> {formatBytes(user.stats.storageBytes)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {formatDate(user.createdAt)}
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-600 flex-shrink-0 ml-2" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Pagination */}
                {data && data.pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/5">
                    <p className="text-sm text-gray-500">
                      Page {data.pagination.page} of {data.pagination.totalPages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page <= 1}
                        onClick={() => setPage(p => p - 1)}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page >= data.pagination.totalPages}
                        onClick={() => setPage(p => p + 1)}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* User Detail Panel */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">User Details</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedUser ? (
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-lg">{selectedUser.name}</h3>
                        <Badge
                          variant="secondary"
                          className={`${tierColors[selectedUser.plan.tier]} text-white`}
                        >
                          {selectedUser.plan.tier}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Mail className="w-3 h-3" /> {selectedUser.email}
                      </p>
                      {selectedUser.username && (
                        <p className="text-sm text-gray-600">@{selectedUser.username}</p>
                      )}
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-gray-400">Storage Quota</h4>
                      <Progress
                        value={selectedUser.plan.quotaMinutesUsed}
                        max={selectedUser.plan.monthlyMinutes}
                        variant={
                          selectedUser.plan.quotaMinutesUsed / selectedUser.plan.monthlyMinutes > 0.9
                            ? 'error'
                            : selectedUser.plan.quotaMinutesUsed / selectedUser.plan.monthlyMinutes > 0.7
                              ? 'warning'
                              : 'default'
                        }
                        showValue
                      />
                      <p className="text-xs text-gray-500">
                        {selectedUser.plan.quotaMinutesUsed} / {selectedUser.plan.monthlyMinutes} minutes used
                      </p>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-gray-400">Statistics</h4>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 bg-black/20 rounded-lg text-center">
                          <p className="text-xl font-bold">{selectedUser.stats.trackCount}</p>
                          <p className="text-xs text-gray-500">Tracks</p>
                        </div>
                        <div className="p-3 bg-black/20 rounded-lg text-center">
                          <p className="text-xl font-bold">{selectedUser.stats.mashupCount}</p>
                          <p className="text-xs text-gray-500">Mashups</p>
                        </div>
                        <div className="p-3 bg-black/20 rounded-lg text-center">
                          <p className="text-xl font-bold">{formatBytes(selectedUser.stats.storageBytes)}</p>
                          <p className="text-xs text-gray-500">Storage</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-sm font-medium text-gray-400">Activity</h4>
                      <p className="text-sm text-gray-500">
                        Joined {formatDate(selectedUser.createdAt)} ({daysSince(selectedUser.createdAt)} days ago)
                      </p>
                      <p className="text-sm text-gray-500">
                        Last active: {selectedUser.lastActiveAt ? formatDate(selectedUser.lastActiveAt) : 'Never'}
                      </p>
                      <div className="flex items-center gap-1 text-sm">
                        {selectedUser.emailVerified ? (
                          <span className="text-green-500 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Email verified
                          </span>
                        ) : (
                          <span className="text-yellow-500 flex items-center gap-1">
                            <XCircle className="w-3 h-3" /> Email not verified
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-white/5">
                      <h4 className="text-sm font-medium text-gray-400">Actions</h4>
                      {selectedUser.isSuspended ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => handleUnsuspend(selectedUser.id)}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" /> Unsuspend User
                        </Button>
                      ) : (
                        <Button
                          variant="destructive"
                          size="sm"
                          className="w-full"
                          onClick={() => handleSuspend(selectedUser.id)}
                        >
                          <Ban className="w-4 h-4 mr-2" /> Suspend User
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => handleResetPassword(selectedUser.id)}
                      >
                        <Key className="w-4 h-4 mr-2" /> Send Password Reset
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">Select a user to view details</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
