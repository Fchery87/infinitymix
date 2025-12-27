'use client';

import { useState, useEffect } from 'react';
import { Project } from '@/lib/db/schema';
import { FolderOpen, Plus, Loader2, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ProjectSelectorProps {
  selectedProjectId: string | null;
  onProjectChange: (projectId: string | null) => void;
  onCreateNew?: () => void;
  className?: string;
}

export function ProjectSelector({
  selectedProjectId,
  onProjectChange,
  onCreateNew,
  className = '',
}: ProjectSelectorProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/projects');
      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects || []);
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <div className={`relative ${className}`}>
      <label className="mb-2 block text-sm font-medium text-gray-400">
        Project (Optional)
      </label>
      
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left transition-all hover:border-white/20 hover:bg-white/10"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <FolderOpen className="h-4 w-4 text-primary flex-shrink-0" />
          {isLoading ? (
            <span className="text-sm text-gray-400">Loading projects...</span>
          ) : selectedProject ? (
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-white truncate block">
                {selectedProject.name}
              </span>
            </div>
          ) : (
            <span className="text-sm text-gray-400">No project selected</span>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-gray-400 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Dropdown */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="absolute left-0 right-0 top-full z-50 mt-2 max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-gradient-to-br from-gray-900/95 via-gray-900/90 to-black/95 backdrop-blur-xl shadow-2xl"
            >
              {/* No Project Option */}
              <button
                type="button"
                onClick={() => {
                  onProjectChange(null);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-3 text-left text-sm transition-colors hover:bg-white/10 ${
                  !selectedProjectId
                    ? 'bg-primary/20 text-primary'
                    : 'text-gray-400'
                }`}
              >
                No project
              </button>

              {/* Divider */}
              {projects.length > 0 && (
                <div className="border-t border-white/10" />
              )}

              {/* Project List */}
              {projects.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-gray-500">
                  No projects yet
                </div>
              ) : (
                projects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => {
                      onProjectChange(project.id);
                      setIsOpen(false);
                    }}
                    className={`w-full px-4 py-3 text-left transition-colors hover:bg-white/10 ${
                      selectedProjectId === project.id
                        ? 'bg-primary/20 text-primary'
                        : 'text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="h-3 w-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: project.color || '#F97316' }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {project.name}
                        </p>
                        {project.description && (
                          <p className="text-xs text-gray-500 truncate">
                            {project.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}

              {/* Create New Project */}
              {onCreateNew && (
                <>
                  <div className="border-t border-white/10" />
                  <button
                    type="button"
                    onClick={() => {
                      onCreateNew();
                      setIsOpen(false);
                    }}
                    className="w-full px-4 py-3 text-left text-sm font-medium text-primary transition-colors hover:bg-primary/10 flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Create New Project
                  </button>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
