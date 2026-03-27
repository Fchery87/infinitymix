// src/components/ui/shortcut-feedback.tsx
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Volume2, VolumeX, Maximize, SkipBack, SkipForward } from 'lucide-react';

interface ShortcutFeedbackProps {
  label: string;
  icon?: string;
  visible: boolean;
}

const iconMap: Record<string, React.ReactNode> = {
  play: <Play className="w-5 h-5" />,
  pause: <Pause className="w-5 h-5" />,
  'seek-back': <SkipBack className="w-5 h-5" />,
  'seek-forward': <SkipForward className="w-5 h-5" />,
  mute: <VolumeX className="w-5 h-5" />,
  unmute: <Volume2 className="w-5 h-5" />,
  fullscreen: <Maximize className="w-5 h-5" />,
};

export function ShortcutFeedback({ label, icon, visible }: ShortcutFeedbackProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 10 }}
          transition={{ duration: 0.15 }}
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9990] pointer-events-none"
        >
          <div className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-black/80 backdrop-blur-xl border border-white/10 shadow-2xl">
            {icon && iconMap[icon] && (
              <span className="text-white/80">{iconMap[icon]}</span>
            )}
            <span className="text-lg font-semibold text-white">{label}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
