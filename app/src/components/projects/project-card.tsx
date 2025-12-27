'use client';

import { Project } from '@/lib/db/schema';
import { motion } from 'framer-motion';
import { Music, Calendar, Disc3, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

interface ProjectCardProps {
  project: Project;
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

export function ProjectCard({ project }: ProjectCardProps) {
  const accentColor = '#F97316'; // Primary orange

  return (
    <Link href={`/projects/${project.id}`}>
      <motion.div
        whileHover={{ scale: 1.03, y: -6 }}
        whileTap={{ scale: 0.97 }}
        className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/8 via-white/3 to-white/[0.02] backdrop-blur-md transition-all hover:border-primary/30 hover:shadow-xl hover:shadow-primary/20"
      >
        {/* Animated gradient border on hover */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/0 to-primary/0 group-hover:from-primary/20 group-hover:to-primary/5 transition-all duration-300 pointer-events-none" />

        {/* Cover Image or Gradient */}
        <div
          className="relative h-40 w-full bg-gradient-to-br from-white/10 to-transparent overflow-hidden"
          style={{
            backgroundColor: project.coverImageUrl ? undefined : accentColor + '20',
            backgroundImage: project.coverImageUrl
              ? `url(${project.coverImageUrl})`
              : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {/* Overlay for images */}
          {project.coverImageUrl && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          )}

          {/* Icon for no image */}
          {!project.coverImageUrl && (
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <Music className="h-12 w-12 text-white/40" />
              </motion.div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="relative p-5">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-white line-clamp-1 group-hover:text-primary transition-colors">
                {project.name}
              </h3>
            </div>
            <span
              className={`ml-2 rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap flex-shrink-0 ${
                statusColors[project.status]
              }`}
            >
              {statusLabels[project.status]}
            </span>
          </div>

          {project.description && (
            <p className="mb-4 text-sm text-gray-400 line-clamp-2">
              {project.description}
            </p>
          )}

          {/* Metadata */}
          <div className="mb-4 flex flex-wrap gap-3 text-xs text-gray-500">
            {project.bpmLock && (
              <div className="flex items-center gap-1.5">
                <Music className="h-3.5 w-3.5 text-primary/60" />
                <span className="text-gray-400">{project.bpmLock} BPM</span>
              </div>
            )}
            {project.keyLock && (
              <div className="flex items-center gap-1.5">
                <Disc3 className="h-3.5 w-3.5 text-primary/60" />
                <span className="text-gray-400">{project.keyLock}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-primary/60" />
              <span className="text-gray-400">
                {formatDistanceToNow(new Date(project.updatedAt), {
                  addSuffix: true,
                })}
              </span>
            </div>
          </div>

          {/* CTA */}
          <motion.div
            className="flex items-center gap-2 text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity"
            initial={false}
            animate={{ x: 0 }}
          >
            Open project
            <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
          </motion.div>
        </div>
      </motion.div>
    </Link>
  );
}
