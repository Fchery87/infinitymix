// src/components/ui/toast.tsx
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils/helpers';
import type { Toast, ToastType } from '@/hooks/useToast';

interface ToastProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

const toastIcons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="w-5 h-5 text-green-500" />,
  error: <AlertCircle className="w-5 h-5 text-red-500" />,
  warning: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
  info: <Info className="w-5 h-5 text-blue-500" />,
};

const toastStyles: Record<ToastType, string> = {
  success: 'bg-green-500/10 border-green-500/30 text-green-300',
  error: 'bg-red-500/10 border-red-500/30 text-red-300',
  warning: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300',
  info: 'bg-blue-500/10 border-blue-500/30 text-blue-300',
};

export function ToastContainer({ toasts, onRemove }: ToastProps) {
  return (
    <div className="fixed bottom-4 right-4 z-[1700] flex flex-col gap-2">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.9 }}
            layout
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-sm min-w-[300px] max-w-md',
              toastStyles[toast.type]
            )}
            role="alert"
          >
            {toastIcons[toast.type]}
            <p className="flex-1 text-sm font-medium">{toast.message}</p>
            <button
              onClick={() => onRemove(toast.id)}
              className="p-1 hover:bg-white/10 rounded transition-colors"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
