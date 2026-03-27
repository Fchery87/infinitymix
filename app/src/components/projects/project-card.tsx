'use client';

import { Project } from '@/lib/db/schema';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Music,
  Calendar,
  Disc3,
  ArrowRight,
  Star,
  Check,
} from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { useCallback } from 'react';

interface ProjectCardProps {
  project: Project;
  isSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  onTogglePin?: (id: string, isPinned: boolean) => void;
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

export function ProjectCard({
  project,
  isSelectMode,
  isSelected,
  onToggleSelect,
  onTogglePin,
}: ProjectCardProps) {
  const accentColor = '#F97316';

  const handleSelect = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onToggleSelect?.(project.id);
    },
    [onToggleSelect, project.id]
  );

  const handlePin = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onTogglePin?.(project.id, !project.isPinned);
    },
    [onTogglePin, project.id, project.isPinned]
  );

  const cardContent = (
    <motion.div
      whileHover={{ scale: 1.03, y: -6 }}
      whileTap={{ scale: 0.97 }}
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/8 via-white/3 to-white/[0.02] backdrop-blur-md transition-all hover:border-primary/30 hover:shadow-xl hover:shadow-primary/20"
      style={isSelected ? { borderColor: 'rgba(249,115,22,0.6)' } : undefined}
    >
      {/* Animated gradient border on hover */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/0 to-primary/0 group-hover:from-primary/20 group-hover:to-primary/5 transition-all duration-300 pointer-events-none" />

      {/* Selection checkbox */}
      <AnimatePresence>
        {isSelectMode && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute top-3 left-3 z-20"
          >
            <button
              onClick={handleSelect}
              className={`flex h-7 w-7 items-center justify-center rounded-lg border-2 transition-all ${
                isSelected
                  ? 'border-primary bg-primary text-white shadow-lg shadow-primary/40'
                  : 'border-white/30 bg-black/40 backdrop-blur-sm hover:border-primary/60'
              }`}
            >
              {isSelected && <Check className="h-4 w-4" />}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pin button */}
      {!isSelectMode && (
        <motion.button
          onClick={handlePin}
          whileHover={{ scale: 1.2 }}
          whileTap={{ scale: 0.9 }}
          className="absolute top-3 right-3 z-20 flex h-8 w-8 items-center justify-center rounded-lg bg-black/40 backdrop-blur-sm border border-white/10 transition-all hover:border-amber-400/50 hover:bg-amber-500/20"
        >
          <Star
            className={`h-4 w-4 transition-colors ${
              project.isPinned
                ? 'fill-amber-400 text-amber-400'
                : 'text-gray-400 group-hover:text-amber-300'
            }`}
          />
        </motion.button>
      )}

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
        {project.coverImageUrl && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        )}

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

        {/* Pinned badge overlay on cover */}
        {project.isPinned && !isSelectMode && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-amber-500/20 backdrop-blur-sm border border-amber-400/30 px-2.5 py-1">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            <span className="text-xs font-medium text-amber-300">Pinned</span>
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
  );

  if (isSelectMode) {
    return (
      <div onClick={handleSelect} className="cursor-pointer">
        {cardContent}
      </div>
    );
  }

  return <Link href={`/projects/${project.id}`}>{cardContent}</Link>;
}
