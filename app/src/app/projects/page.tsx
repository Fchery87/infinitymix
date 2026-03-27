'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { ProjectGrid } from '@/components/projects/project-grid';
import { CreateProjectModal } from '@/components/projects/create-project-modal';
import { Project } from '@/lib/db/schema';
import {
  Plus,
  Loader2,
  Music,
  Sparkles,
  Search,
  ArrowUpDown,
  CheckSquare,
  X,
  Archive,
  ArchiveRestore,
  Star,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Navigation } from '@/components/navigation';

const STATUS_FILTERS = [
  { value: 'all', label: 'All Projects' },
  { value: 'idea', label: 'Ideas' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
] as const;

type SortField =
  | 'updatedAt'
  | 'name'
  | 'createdAt'
  | 'trackCount'
  | 'mashupCount';

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'updatedAt', label: 'Last Modified' },
  { value: 'name', label: 'Name' },
  { value: 'createdAt', label: 'Created Date' },
];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortAsc, setSortAsc] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  const fetchProjects = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch('/api/projects');
      if (!response.ok) throw new Error('Failed to fetch projects');
      const data = await response.json();
      setProjects(data.projects);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const filteredAndSorted = useMemo(() => {
    let result = [...projects];

    // Status filter
    if (activeFilter !== 'all') {
      result = result.filter((p) => p.status === activeFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q)
      );
    }

    // Sort: pinned first, then by selected field
    result.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;

      let cmp = 0;
      if (sortField === 'name') {
        cmp = a.name.localeCompare(b.name);
      } else if (sortField === 'createdAt') {
        cmp =
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else {
        cmp =
          new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      }
      return sortAsc ? cmp : -cmp;
    });

    return result;
  }, [projects, activeFilter, searchQuery, sortField, sortAsc]);

  const pinnedProjects = useMemo(
    () => filteredAndSorted.filter((p) => p.isPinned),
    [filteredAndSorted]
  );

  const unpinnedProjects = useMemo(
    () => filteredAndSorted.filter((p) => !p.isPinned),
    [filteredAndSorted]
  );

  const handleTogglePin = useCallback(
    async (id: string, isPinned: boolean) => {
      // Optimistic update
      setProjects((prev) =>
        prev.map((p) => (p.id === id ? { ...p, isPinned } : p))
      );
      try {
        await fetch(`/api/projects/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isPinned }),
        });
      } catch {
        // Revert on failure
        setProjects((prev) =>
          prev.map((p) => (p.id === id ? { ...p, isPinned: !isPinned } : p))
        );
      }
    },
    []
  );

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleBulkStatusChange = async (status: 'archived' | 'in_progress') => {
    if (selectedIds.size === 0) return;
    setIsBulkUpdating(true);
    try {
      await fetch('/api/projects/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectIds: Array.from(selectedIds),
          status,
        }),
      });
      // Update local state
      setProjects((prev) =>
        prev.map((p) =>
          selectedIds.has(p.id) ? { ...p, status } : p
        )
      );
      setSelectedIds(new Set());
      setIsSelectMode(false);
    } catch (err) {
      console.error('Bulk update failed:', err);
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const exitSelectMode = () => {
    setIsSelectMode(false);
    setSelectedIds(new Set());
  };

  return (
    <div className="min-h-screen font-sans text-foreground relative z-0">
      {/* Background Elements */}
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-background via-background to-black pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-primary/15 rounded-full blur-[120px] opacity-20 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[400px] bg-blue-600/10 rounded-full blur-[100px] opacity-15 pointer-events-none" />
      <div className="absolute top-1/3 left-0 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[100px] opacity-10 pointer-events-none" />

      {/* Navbar */}
      <Navigation />

      {/* Main Content */}
      <main className="relative z-10 pt-32 pb-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <div className="mb-6 flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
            <div>
              <div className="mb-4 flex items-center gap-3">
                <div className="p-3 rounded-xl bg-primary/20 w-fit">
                  <Music className="h-6 w-6 text-primary" />
                </div>
                <h1 className="text-5xl lg:text-6xl font-bold text-white tracking-tight">
                  Your Projects
                </h1>
              </div>
              <p className="text-lg text-gray-400 max-w-lg">
                Organize your tracks, stems, and mashups into projects. Keep
                your creative workspace clean and focused.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <AnimatePresence>
                {isSelectMode ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex items-center gap-2"
                  >
                    <span className="text-sm text-gray-400 font-medium mr-2">
                      {selectedIds.size} selected
                    </span>
                    <button
                      onClick={() => handleBulkStatusChange('archived')}
                      disabled={selectedIds.size === 0 || isBulkUpdating}
                      className="flex items-center gap-2 rounded-xl bg-gray-500/20 border border-gray-500/30 px-4 py-3 text-sm font-semibold text-gray-300 transition-all hover:bg-gray-500/30 hover:text-white disabled:opacity-40"
                    >
                      <Archive className="h-4 w-4" />
                      Archive
                    </button>
                    <button
                      onClick={() => handleBulkStatusChange('in_progress')}
                      disabled={selectedIds.size === 0 || isBulkUpdating}
                      className="flex items-center gap-2 rounded-xl bg-cyan-500/20 border border-cyan-500/30 px-4 py-3 text-sm font-semibold text-cyan-300 transition-all hover:bg-cyan-500/30 hover:text-cyan-200 disabled:opacity-40"
                    >
                      <ArchiveRestore className="h-4 w-4" />
                      Unarchive
                    </button>
                    <button
                      onClick={exitSelectMode}
                      className="flex items-center justify-center rounded-xl bg-white/5 border border-white/10 p-3 text-gray-400 transition-all hover:bg-white/10 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex items-center gap-3"
                  >
                    {projects.length > 0 && (
                      <button
                        onClick={() => setIsSelectMode(true)}
                        className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm font-semibold text-gray-300 transition-all hover:bg-white/10 hover:text-white"
                      >
                        <CheckSquare className="h-4 w-4" />
                        Select
                      </button>
                    )}
                    <motion.button
                      whileHover={{
                        scale: 1.05,
                        boxShadow: '0 0 40px rgba(249, 115, 22, 0.4)',
                      }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setIsModalOpen(true)}
                      className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-orange-500 px-8 py-4 font-semibold text-white shadow-lg shadow-primary/30 transition-all hover:shadow-primary/50 whitespace-nowrap"
                    >
                      <Plus className="h-5 w-5" />
                      New Project
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Search & Sort Row */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center"
          >
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects..."
                className="w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 backdrop-blur-sm transition-all focus:border-primary/40 focus:bg-white/8 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Sort Dropdown */}
            <div className="relative">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500 pointer-events-none" />
                  <select
                    value={sortField}
                    onChange={(e) => setSortField(e.target.value as SortField)}
                    className="appearance-none rounded-xl border border-white/10 bg-white/5 pl-9 pr-8 py-2.5 text-sm text-gray-300 backdrop-blur-sm transition-all hover:border-white/20 hover:bg-white/8 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => setSortAsc(!sortAsc)}
                  className={`rounded-xl border px-3 py-2.5 text-xs font-semibold transition-all ${
                    sortAsc
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/8 hover:text-white'
                  }`}
                >
                  {sortAsc ? 'A-Z' : 'Z-A'}
                </button>
              </div>
            </div>
          </motion.div>

          {/* Status Filter Tabs */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="flex flex-wrap gap-3"
          >
            {STATUS_FILTERS.map((filter) => (
              <motion.button
                key={filter.value}
                onClick={() => setActiveFilter(filter.value)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`relative rounded-full px-5 py-2.5 text-sm font-semibold transition-all overflow-hidden group ${
                  activeFilter === filter.value
                    ? 'bg-gradient-to-r from-primary/20 to-orange-500/10 text-primary border border-primary/40 shadow-lg shadow-primary/25'
                    : 'bg-white/5 text-gray-300 border border-white/10 hover:bg-white/8 hover:text-white hover:border-white/20'
                }`}
              >
                <span className="relative z-10">{filter.label}</span>
                {filter.value !== 'all' && (
                  <span
                    className={`ml-2 text-xs font-medium px-2 py-0.5 rounded-full ${
                      activeFilter === filter.value
                        ? 'bg-primary/30 text-primary'
                        : 'bg-white/5 text-gray-400'
                    }`}
                  >
                    {projects.filter((p) => p.status === filter.value).length}
                  </span>
                )}
              </motion.button>
            ))}
          </motion.div>
        </motion.div>

        {/* Content */}
        {isLoading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex min-h-[500px] items-center justify-center"
          >
            <div className="text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="mx-auto mb-6 w-fit"
              >
                <Loader2 className="h-16 w-16 text-primary" />
              </motion.div>
              <p className="text-lg text-gray-400">
                Loading your creative workspace...
              </p>
            </div>
          </motion.div>
        ) : error ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-red-500/30 bg-gradient-to-br from-red-500/10 to-red-500/5 backdrop-blur-lg p-8 text-center"
          >
            <div className="mb-4 text-center">
              <div className="mx-auto w-fit rounded-full bg-red-500/20 p-4 mb-4">
                <Sparkles className="h-6 w-6 text-red-400" />
              </div>
              <p className="text-lg text-red-300 font-medium">{error}</p>
            </div>
            <button
              onClick={fetchProjects}
              className="mt-6 rounded-lg bg-red-500/20 px-6 py-2 font-medium text-red-300 transition-all hover:bg-red-500/30 hover:text-red-200"
            >
              Try Again
            </button>
          </motion.div>
        ) : filteredAndSorted.length === 0 ? (
          <ProjectGrid projects={[]} />
        ) : (
          <div className="space-y-10">
            {/* Pinned Projects Section */}
            <AnimatePresence>
              {pinnedProjects.length > 0 && (
                <motion.section
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.4 }}
                >
                  <div className="mb-5 flex items-center gap-2.5">
                    <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                    <h2 className="text-xl font-bold text-white">
                      Pinned Projects
                    </h2>
                    <span className="text-sm text-gray-500 font-medium">
                      ({pinnedProjects.length})
                    </span>
                  </div>
                  <ProjectGrid
                    projects={pinnedProjects}
                    isSelectMode={isSelectMode}
                    selectedIds={selectedIds}
                    onToggleSelect={handleToggleSelect}
                    onTogglePin={handleTogglePin}
                  />
                </motion.section>
              )}
            </AnimatePresence>

            {/* All Projects Section */}
            {unpinnedProjects.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
              >
                {pinnedProjects.length > 0 && (
                  <div className="mb-5 flex items-center gap-2.5">
                    <Music className="h-5 w-5 text-primary" />
                    <h2 className="text-xl font-bold text-white">All Projects</h2>
                    <span className="text-sm text-gray-500 font-medium">
                      ({unpinnedProjects.length})
                    </span>
                  </div>
                )}
                <ProjectGrid
                  projects={unpinnedProjects}
                  isSelectMode={isSelectMode}
                  selectedIds={selectedIds}
                  onToggleSelect={handleToggleSelect}
                  onTogglePin={handleTogglePin}
                />
              </motion.section>
            )}
          </div>
        )}
      </main>

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
