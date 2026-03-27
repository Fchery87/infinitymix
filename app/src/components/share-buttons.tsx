'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Share2, ExternalLink, Check, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils/helpers';

interface ShareButtonsProps {
  mashupId: string;
  mashupName: string;
  isPublic: boolean;
  publicSlug?: string | null;
  className?: string;
}

type ShareTarget = 'soundcloud' | 'instagram' | 'tiktok' | 'copy';

const SOCIAL_CONFIG: Record<
  Exclude<ShareTarget, 'copy'>,
  { label: string; icon: string; color: string; hoverBg: string; buildUrl: (shareUrl: string, name: string) => string }
> = {
  soundcloud: {
    label: 'SoundCloud',
    icon: '☁',
    color: 'text-orange-400',
    hoverBg: 'hover:bg-orange-500/10 hover:border-orange-500/30',
    buildUrl: (shareUrl) =>
      `https://soundcloud.com/upload?uri=${encodeURIComponent(shareUrl)}`,
  },
  instagram: {
    label: 'Instagram',
    icon: '◎',
    color: 'text-pink-400',
    hoverBg: 'hover:bg-pink-500/10 hover:border-pink-500/30',
    buildUrl: (shareUrl, name) =>
      `https://www.instagram.com/?url=${encodeURIComponent(shareUrl)}`,
  },
  tiktok: {
    label: 'TikTok',
    icon: '♪',
    color: 'text-cyan-400',
    hoverBg: 'hover:bg-cyan-500/10 hover:border-cyan-500/30',
    buildUrl: (shareUrl) =>
      `https://www.tiktok.com/upload?lang=en&share_url=${encodeURIComponent(shareUrl)}`,
  },
};

export function ShareButtons({
  mashupId,
  mashupName,
  isPublic,
  publicSlug,
  className,
}: ShareButtonsProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = publicSlug
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/api/mashups/public?slug=${publicSlug}`
    : null;

  const handleShare = (target: ShareTarget) => {
    if (target === 'copy') {
      if (!shareUrl) {
        alert('Make this mashup public first to get a shareable link.');
        return;
      }
      navigator.clipboard.writeText(shareUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
      return;
    }

    if (!shareUrl) {
      alert('Make this mashup public first to share.');
      return;
    }

    const config = SOCIAL_CONFIG[target];
    const url = config.buildUrl(shareUrl, mashupName);
    window.open(url, '_blank', 'noopener,noreferrer,width=600,height=600');
  };

  return (
    <div className={cn('relative', className)}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setExpanded(!expanded)}
        className="text-gray-400 hover:text-white relative"
        aria-label="Share mashup"
      >
        <Share2 className="w-4 h-4 mr-1.5" />
        Share
      </Button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-1 z-50 bg-black/95 backdrop-blur-xl border border-white/10 rounded-xl p-2 shadow-2xl min-w-[180px]"
          >
            {!isPublic && (
              <p className="text-xs text-gray-500 px-2 py-1.5 mb-1 border-b border-white/5">
                Make public to enable sharing
              </p>
            )}

            {(Object.entries(SOCIAL_CONFIG) as [string, (typeof SOCIAL_CONFIG)[keyof typeof SOCIAL_CONFIG]][]).map(
              ([key, config]) => (
                <button
                  key={key}
                  onClick={() => handleShare(key as ShareTarget)}
                  disabled={!isPublic}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all',
                    'text-gray-300 hover:text-white border border-transparent',
                    config.hoverBg,
                    !isPublic && 'opacity-40 cursor-not-allowed'
                  )}
                >
                  <span className={cn('text-base w-5 text-center', config.color)}>
                    {config.icon}
                  </span>
                  {config.label}
                  <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
                </button>
              )
            )}

            <div className="border-t border-white/5 mt-1 pt-1">
              <button
                onClick={() => handleShare('copy')}
                disabled={!isPublic}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all',
                  'text-gray-300 hover:text-white border border-transparent',
                  'hover:bg-white/5',
                  !isPublic && 'opacity-40 cursor-not-allowed'
                )}
              >
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {expanded && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setExpanded(false)}
        />
      )}
    </div>
  );
}
