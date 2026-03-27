'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Shield,
  Search,
  AlertTriangle,
  Flag,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  FileWarning,
  MessageSquare,
  Music,
  User,
  ExternalLink,
} from 'lucide-react';

type ModerationStatus = 'flagged' | 'reviewing' | 'resolved' | 'dismissed';
type ReportReason = 'dmca' | 'inappropriate' | 'spam' | 'copyright' | 'other';

type FlaggedMashup = {
  id: string;
  mashupId: string;
  mashupName: string;
  mashupSlug: string | null;
  mashupIsPublic: boolean;
  userId: string;
  userName: string;
  userEmail: string;
  status: ModerationStatus;
  reason: ReportReason;
  reportCount: number;
  firstReportedAt: string;
  lastReportedAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  notes: string | null;
};

type UserReport = {
  id: string;
  reporterUserId: string;
  reporterName: string;
  targetMashupId: string | null;
  targetMashupName: string | null;
  targetUserId: string | null;
  targetUserName: string | null;
  reason: ReportReason;
  description: string;
  status: 'pending' | 'reviewing' | 'resolved';
  createdAt: string;
  reviewedAt: string | null;
};

type ModerationData = {
  flaggedMashups: FlaggedMashup[];
  userReports: UserReport[];
  stats: {
    totalFlagged: number;
    pendingReports: number;
    dmcaRequests: number;
    resolvedThisMonth: number;
  };
};

const reasonLabels: Record<ReportReason, string> = {
  dmca: 'DMCA Takedown',
  inappropriate: 'Inappropriate Content',
  spam: 'Spam',
  copyright: 'Copyright Infringement',
  other: 'Other',
};

const reasonColors: Record<ReportReason, string> = {
  dmca: 'bg-red-500',
  inappropriate: 'bg-orange-500',
  spam: 'bg-yellow-500',
  copyright: 'bg-purple-500',
  other: 'bg-gray-500',
};

const statusColors: Record<ModerationStatus, string> = {
  flagged: 'bg-red-500',
  reviewing: 'bg-yellow-500',
  resolved: 'bg-green-500',
  dismissed: 'bg-gray-500',
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function daysAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export default function AdminModerationPage() {
  const [data, setData] = useState<ModerationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'flagged' | 'reports' | 'dmca'>('flagged');
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<FlaggedMashup | null>(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/moderation');
      if (!response.ok) throw new Error('Failed to load moderation data');
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load moderation data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/moderation/${id}/approve`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to approve');
      await loadData();
      setSelectedItem(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to approve');
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm('Remove this mashup from public visibility?')) return;
    try {
      const res = await fetch(`/api/admin/moderation/${id}/remove`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to remove');
      await loadData();
      setSelectedItem(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove');
    }
  };

  const handleDmcaTakedown = async (id: string) => {
    if (!confirm('Execute DMCA takedown? This will remove the mashup and notify the user.')) return;
    try {
      const res = await fetch(`/api/admin/moderation/${id}/dmca-takedown`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to process takedown');
      await loadData();
      setSelectedItem(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to process takedown');
    }
  };

  const filteredFlagged = data?.flaggedMashups.filter((item) => {
    if (search) {
      const q = search.toLowerCase();
      return (
        item.mashupName.toLowerCase().includes(q) ||
        item.userName.toLowerCase().includes(q) ||
        item.userEmail.toLowerCase().includes(q)
      );
    }
    if (activeTab === 'dmca') return item.reason === 'dmca';
    return true;
  }) ?? [];

  const filteredReports = data?.userReports.filter((report) => {
    if (search) {
      const q = search.toLowerCase();
      return (
        (report.targetMashupName?.toLowerCase().includes(q)) ||
        (report.targetUserName?.toLowerCase().includes(q)) ||
        report.description.toLowerCase().includes(q)
      );
    }
    return true;
  }) ?? [];

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
                <Shield className="w-5 h-5" /> Content Moderation
              </h1>
            </div>
            {data && (
              <div className="flex items-center gap-2">
                {data.stats.pendingReports > 0 && (
                  <Badge variant="destructive">{data.stats.pendingReports} pending reports</Badge>
                )}
                {data.stats.dmcaRequests > 0 && (
                  <Badge className="bg-red-500 text-white">{data.stats.dmcaRequests} DMCA requests</Badge>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Flagged Content</p>
                  <p className="text-3xl font-bold text-red-500">{data?.stats.totalFlagged ?? 0}</p>
                </div>
                <div className="p-3 bg-red-500/10 rounded-lg">
                  <Flag className="w-6 h-6 text-red-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Pending Reports</p>
                  <p className="text-3xl font-bold text-yellow-500">{data?.stats.pendingReports ?? 0}</p>
                </div>
                <div className="p-3 bg-yellow-500/10 rounded-lg">
                  <MessageSquare className="w-6 h-6 text-yellow-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">DMCA Requests</p>
                  <p className="text-3xl font-bold text-purple-500">{data?.stats.dmcaRequests ?? 0}</p>
                </div>
                <div className="p-3 bg-purple-500/10 rounded-lg">
                  <FileWarning className="w-6 h-6 text-purple-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Resolved (Month)</p>
                  <p className="text-3xl font-bold text-green-500">{data?.stats.resolvedThisMonth ?? 0}</p>
                </div>
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 bg-black/20 rounded-lg w-fit">
          {([
            { key: 'flagged', label: 'Flagged Content', icon: Flag },
            { key: 'reports', label: 'User Reports', icon: MessageSquare },
            { key: 'dmca', label: 'DMCA Takedowns', icon: FileWarning },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.key === 'reports' && data && data.stats.pendingReports > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">
                  {data.stats.pendingReports}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                placeholder="Search by mashup name, user, or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Content List */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {activeTab === 'flagged' && 'Flagged Mashups'}
                  {activeTab === 'reports' && 'User Reports'}
                  {activeTab === 'dmca' && 'DMCA Requests'}
                </CardTitle>
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
                    <Button onClick={loadData} variant="outline" className="mt-4">Retry</Button>
                  </div>
                ) : activeTab === 'reports' ? (
                  filteredReports.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No reports found</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredReports.map((report) => (
                        <div
                          key={report.id}
                          className="p-4 rounded-lg border border-white/10 bg-black/20"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="secondary"
                                className={`${
                                  report.status === 'pending'
                                    ? 'bg-yellow-500'
                                    : report.status === 'reviewing'
                                      ? 'bg-blue-500'
                                      : 'bg-green-500'
                                } text-white text-xs`}
                              >
                                {report.status}
                              </Badge>
                              <Badge
                                variant="secondary"
                                className={`${reasonColors[report.reason]} text-white text-xs`}
                              >
                                {reasonLabels[report.reason]}
                              </Badge>
                            </div>
                            <span className="text-xs text-gray-500">{formatDate(report.createdAt)}</span>
                          </div>
                          {report.targetMashupName && (
                            <p className="text-sm font-medium flex items-center gap-1 mb-1">
                              <Music className="w-3 h-3" /> {report.targetMashupName}
                            </p>
                          )}
                          <p className="text-sm text-gray-400 mb-2 line-clamp-2">{report.description}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <User className="w-3 h-3" />
                            Reported by {report.reporterName}
                            {report.targetUserName && <> against {report.targetUserName}</>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : filteredFlagged.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No flagged content</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredFlagged.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setSelectedItem(item)}
                        className={`w-full text-left p-4 rounded-lg border transition-colors ${
                          selectedItem?.id === item.id
                            ? 'border-primary/50 bg-primary/5'
                            : 'border-white/10 bg-black/20 hover:bg-black/30'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="secondary"
                              className={`${statusColors[item.status]} text-white text-xs`}
                            >
                              {item.status}
                            </Badge>
                            <Badge
                              variant="secondary"
                              className={`${reasonColors[item.reason]} text-white text-xs`}
                            >
                              {reasonLabels[item.reason]}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {item.reportCount} report{item.reportCount !== 1 ? 's' : ''}
                            </Badge>
                          </div>
                          <span className="text-xs text-gray-500">{daysAgo(item.firstReportedAt)}d ago</span>
                        </div>
                        <p className="font-medium truncate">{item.mashupName}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" /> {item.userName}
                          </span>
                          <span className="flex items-center gap-1">
                            {item.mashupIsPublic ? (
                              <Eye className="w-3 h-3 text-green-500" />
                            ) : (
                              <EyeOff className="w-3 h-3 text-gray-500" />
                            )}
                            {item.mashupIsPublic ? 'Public' : 'Private'}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Detail / Action Panel */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Actions</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedItem ? (
                  <div className="space-y-5">
                    <div>
                      <h3 className="font-semibold text-lg mb-1">{selectedItem.mashupName}</h3>
                      <div className="flex items-center gap-2 mb-3">
                        <Badge
                          variant="secondary"
                          className={`${statusColors[selectedItem.status]} text-white`}
                        >
                          {selectedItem.status}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className={`${reasonColors[selectedItem.reason]} text-white`}
                        >
                          {reasonLabels[selectedItem.reason]}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-gray-400">Creator</h4>
                      <p className="text-sm">{selectedItem.userName}</p>
                      <p className="text-xs text-gray-500">{selectedItem.userEmail}</p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-gray-400">Report Details</h4>
                      <div className="text-sm space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Reports</span>
                          <span>{selectedItem.reportCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">First reported</span>
                          <span>{formatDate(selectedItem.firstReportedAt)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Last reported</span>
                          <span>{formatDate(selectedItem.lastReportedAt)}</span>
                        </div>
                      </div>
                    </div>

                    {selectedItem.notes && (
                      <div className="space-y-1">
                        <h4 className="text-sm font-medium text-gray-400">Notes</h4>
                        <p className="text-sm text-gray-300 bg-black/20 p-3 rounded-lg">{selectedItem.notes}</p>
                      </div>
                    )}

                    {selectedItem.mashupSlug && (
                      <Link href={`/m/${selectedItem.mashupSlug}`} target="_blank">
                        <Button variant="outline" size="sm" className="w-full">
                          <ExternalLink className="w-4 h-4 mr-2" /> View Mashup
                        </Button>
                      </Link>
                    )}

                    <div className="space-y-2 pt-2 border-t border-white/5">
                      <h4 className="text-sm font-medium text-gray-400">Moderation Actions</h4>
                      {selectedItem.status !== 'resolved' && selectedItem.status !== 'dismissed' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-green-500 border-green-500/30 hover:bg-green-500/10"
                            onClick={() => handleApprove(selectedItem.id)}
                          >
                            <CheckCircle2 className="w-4 h-4 mr-2" /> Approve (Dismiss)
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => handleRemove(selectedItem.id)}
                          >
                            <EyeOff className="w-4 h-4 mr-2" /> Remove from Public
                          </Button>
                          {selectedItem.reason === 'dmca' && (
                            <Button
                              variant="destructive"
                              size="sm"
                              className="w-full"
                              onClick={() => handleDmcaTakedown(selectedItem.id)}
                            >
                              <FileWarning className="w-4 h-4 mr-2" /> Execute DMCA Takedown
                            </Button>
                          )}
                        </>
                      )}
                      {(selectedItem.status === 'resolved' || selectedItem.status === 'dismissed') && (
                        <p className="text-sm text-gray-500 text-center py-2">
                          This item has been {selectedItem.status}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <Shield className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">Select a flagged item to take action</p>
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
