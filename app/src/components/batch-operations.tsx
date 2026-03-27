'use client';

import { Button } from '@/components/ui/button';
import { Download, Trash2, Globe, Lock, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils/helpers';

interface BatchOperationsProps {
  selectedIds: string[];
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onToggleSelect: (id: string) => void;
  onBatchDelete: () => void;
  onBatchDownload: () => void;
  onBatchMakePublic: () => void;
  onBatchMakePrivate: () => void;
  isDeleting: boolean;
  isDownloading: boolean;
  isUpdatingVisibility: boolean;
}

export function BatchOperations({
  selectedIds,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onToggleSelect,
  onBatchDelete,
  onBatchDownload,
  onBatchMakePublic,
  onBatchMakePrivate,
  isDeleting,
  isDownloading,
  isUpdatingVisibility,
}: BatchOperationsProps) {
  const selectedCount = selectedIds.length;
  const allSelected = selectedCount === totalCount && totalCount > 0;
  const isBusy = isDeleting || isDownloading || isUpdatingVisibility;

  return (
    <div className="flex items-center gap-3">
      {/* Select All Toggle */}
      <button
        onClick={allSelected ? onDeselectAll : onSelectAll}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all border',
          allSelected
            ? 'bg-primary/10 border-primary/30 text-primary'
            : 'border-white/10 text-gray-400 hover:text-white hover:border-white/20'
        )}
      >
        <div
          className={cn(
            'w-4 h-4 rounded border-2 flex items-center justify-center transition-all',
            allSelected
              ? 'bg-primary border-primary'
              : 'border-gray-600 hover:border-gray-400'
          )}
        >
          {allSelected && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        {allSelected ? 'Deselect All' : 'Select All'}
      </button>

      {/* Batch Actions Toolbar */}
      <AnimatePresence>
        {selectedCount > 0 && (
          <motion.div
            initial={{ opacity: 0, x: -10, width: 0 }}
            animate={{ opacity: 1, x: 0, width: 'auto' }}
            exit={{ opacity: 0, x: -10, width: 0 }}
            className="flex items-center gap-2 overflow-hidden"
          >
            <span className="text-sm text-gray-400 whitespace-nowrap">
              {selectedCount} selected
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={onBatchDownload}
              disabled={isBusy}
              className="border-white/10 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
            >
              {isDownloading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5" />
              ) : (
                <Download className="w-4 h-4 mr-1.5" />
              )}
              Download
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onBatchMakePublic}
              disabled={isBusy}
              className="border-white/10 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/30"
            >
              {isUpdatingVisibility ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5" />
              ) : (
                <Globe className="w-4 h-4 mr-1.5" />
              )}
              Make Public
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onBatchMakePrivate}
              disabled={isBusy}
              className="border-white/10 hover:bg-amber-500/10 hover:text-amber-400 hover:border-amber-500/30"
            >
              {isUpdatingVisibility ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5" />
              ) : (
                <Lock className="w-4 h-4 mr-1.5" />
              )}
              Make Private
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onBatchDelete}
              disabled={isBusy}
              className="border-white/10 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
            >
              {isDeleting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5" />
              ) : (
                <Trash2 className="w-4 h-4 mr-1.5" />
              )}
              Delete
            </Button>

            <button
              onClick={onDeselectAll}
              className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
              aria-label="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface MashupCheckboxProps {
  checked: boolean;
  onChange: () => void;
  className?: string;
}

export function MashupCheckbox({ checked, onChange, className }: MashupCheckboxProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className={cn(
        'w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0',
        checked
          ? 'bg-primary border-primary shadow-[0_0_8px_rgba(249,115,22,0.4)]'
          : 'border-gray-600 hover:border-gray-400 bg-transparent',
        className
      )}
      aria-label={checked ? 'Deselect mashup' : 'Select mashup'}
    >
      {checked && (
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
  );
}
