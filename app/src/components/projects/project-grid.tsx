'use client';

import { Project } from '@/lib/db/schema';
import { ProjectCard } from './project-card';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

interface ProjectGridProps {
  projects: Project[];
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
};

export function ProjectGrid({ projects }: ProjectGridProps) {
  if (projects.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="flex min-h-[500px] flex-col items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-md p-12 text-center"
      >
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 4, repeat: Infinity }}
          className="mb-6 rounded-full bg-primary/20 p-6 w-fit"
        >
          <Sparkles className="h-12 w-12 text-primary" />
        </motion.div>
        <h3 className="mb-3 text-2xl font-bold text-white">
          Create your first project
        </h3>
        <p className="mb-8 max-w-md text-base text-gray-400 leading-relaxed">
          Projects help you organize your tracks, stems, and mashups in one creative space. Start your first project to begin crafting.
        </p>
        <div className="flex flex-col items-center gap-3 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary/40" />
            <span>Organize multiple tracks per project</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary/40" />
            <span>Lock BPM and key for consistency</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary/40" />
            <span>Track project status from idea to completion</span>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {projects.map((project, index) => (
        <motion.div
          key={project.id}
          variants={itemVariants}
          layout
        >
          <ProjectCard project={project} />
        </motion.div>
      ))}
    </motion.div>
  );
}
