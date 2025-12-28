'use client';

import { useState, useEffect } from 'react';
import { ProjectGrid } from '@/components/projects/project-grid';
import { CreateProjectModal } from '@/components/projects/create-project-modal';
import { Project } from '@/lib/db/schema';
import { Plus, Loader2, Music, Sparkles, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const STATUS_FILTERS = [
  { value: 'all', label: 'All Projects' },
  { value: 'idea', label: 'Ideas' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
] as const;

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');

  const fetchProjects = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/projects');

      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }

      const data = await response.json();
      setProjects(data.projects);
      setFilteredProjects(data.projects);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (activeFilter === 'all') {
      setFilteredProjects(projects);
    } else {
      setFilteredProjects(
        projects.filter((project) => project.status === activeFilter)
      );
    }
  }, [activeFilter, projects]);

  return (
    <div className="min-h-screen font-sans text-foreground relative z-0">
      {/* Background Elements */}
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-background via-background to-black pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-primary/15 rounded-full blur-[120px] opacity-20 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[400px] bg-blue-600/10 rounded-full blur-[100px] opacity-15 pointer-events-none" />
      <div className="absolute top-1/3 left-0 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[100px] opacity-10 pointer-events-none" />

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

      {/* Main Content */}
      <main className="relative z-10 pt-32 pb-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <div className="mb-8 flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
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
                Organize your tracks, stems, and mashups into projects. Keep your creative workspace clean and focused.
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05, boxShadow: '0 0 40px rgba(249, 115, 22, 0.4)' }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-orange-500 px-8 py-4 font-semibold text-white shadow-lg shadow-primary/30 transition-all hover:shadow-primary/50 whitespace-nowrap"
            >
              <Plus className="h-5 w-5" />
              New Project
            </motion.button>
          </div>

          {/* Status Filter */}
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
                  <span className={`ml-2 text-xs font-medium px-2 py-0.5 rounded-full ${
                    activeFilter === filter.value
                      ? 'bg-primary/30 text-primary'
                      : 'bg-white/5 text-gray-400'
                  }`}>
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
              <p className="text-lg text-gray-400">Loading your creative workspace...</p>
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
        ) : (
          <ProjectGrid projects={filteredProjects} />
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
