// src/hooks/useGlobalShortcuts.ts
'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface GlobalShortcutHandlers {
  onSearch?: () => void;
  onNewMashup?: () => void;
  onSaveDraft?: () => void;
}

export function useGlobalShortcuts(handlers: GlobalShortcutHandlers = {}) {
  const router = useRouter();
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const isMeta = event.metaKey || event.ctrlKey;

    if (!isMeta) return;

    // Cmd+K: Open search (handled by CommandPalette, but allow override)
    if (event.key === 'k') {
      event.preventDefault();
      handlersRef.current.onSearch?.();
      return;
    }

    // Cmd+N: New mashup
    if (event.key === 'n') {
      event.preventDefault();
      if (handlersRef.current.onNewMashup) {
        handlersRef.current.onNewMashup();
      } else {
        router.push('/create');
      }
      return;
    }

    // Cmd+S: Save draft
    if (event.key === 's') {
      event.preventDefault();
      handlersRef.current.onSaveDraft?.();
      return;
    }
  }, [router]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
