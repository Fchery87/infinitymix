'use client';

import { useState, useEffect } from 'react';
import { Project } from '@/lib/db/schema';
import { FolderOpen, Plus, ChevronDown } from 'lucide-react';
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
    <div className={className}>
      <label className="mb-2 block text-sm font-medium text-gray-400">
        Project (Optional)
      </label>

      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] px-4 py-3 text-left transition-all hover:border-primary/30 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-primary/20"
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
            className={`h-4 w-4 text-gray-400 transition-transform duration-300 ${
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
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-white/10 bg-gradient-to-br from-gray-900/98 via-gray-900/95 to-black/98 backdrop-blur-xl shadow-2xl"
              >
                {/* No Project Option */}
                <button
                  type="button"
                  onClick={() => {
                    onProjectChange(null);
                    setIsOpen(false);
                  }}
                  className={`w-full px-4 py-3 text-left text-sm font-medium transition-all first:rounded-t-2xl ${
                    !selectedProjectId
                      ? 'bg-primary/15 text-primary border-b border-primary/20'
                      : 'text-gray-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  No project
                </button>

                {/* Divider */}
                {projects.length > 0 && !selectedProjectId && (
                  <div className="border-t border-white/5" />
                )}

                {/* Project List */}
                {projects.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm text-gray-400">No projects yet</p>
                    <p className="text-xs text-gray-500 mt-1">Create one to organize your tracks</p>
                  </div>
                ) : (
                  <>
                    {projects.length > 0 && (
                      <div className="border-t border-white/5" />
                    )}
                    {projects.map((project) => (
                      <button
                        key={project.id}
                        type="button"
                        onClick={() => {
                          onProjectChange(project.id);
                          setIsOpen(false);
                        }}
                        className={`w-full px-4 py-3 text-left transition-all group ${
                          selectedProjectId === project.id
                            ? 'bg-primary/15 border-l-2 border-primary'
                            : 'border-l-2 border-transparent hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="h-3 w-3 rounded-full flex-shrink-0 ring-2 ring-white/10 group-hover:ring-primary/30 transition-all"
                            style={{ backgroundColor: project.color || '#F97316' }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate transition-colors ${
                              selectedProjectId === project.id
                                ? 'text-primary'
                                : 'text-white group-hover:text-white'
                            }`}>
                              {project.name}
                            </p>
                            {project.description && (
                              <p className="text-xs text-gray-500 truncate group-hover:text-gray-400 transition-colors">
                                {project.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </>
                )}

                {/* Create New Project */}
                {onCreateNew && (
                  <>
                    <div className="border-t border-white/5" />
                    <button
                      type="button"
                      onClick={() => {
                        onCreateNew();
                        setIsOpen(false);
                      }}
                      className="w-full px-4 py-3 text-left text-sm font-medium text-primary transition-colors hover:bg-primary/10 flex items-center gap-2 last:rounded-b-2xl"
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
    </div>
  );
}
