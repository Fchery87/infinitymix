// src/app/create/components/MixModeSelector.tsx
'use client';

import { Music2, Mic2, Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

type MixMode = 'standard' | 'stem_mashup' | 'auto_dj';

interface MixModeSelectorProps {
  value: MixMode;
  onChange: (mode: MixMode) => void;
  stemMashupAvailable?: boolean;
}

export function MixModeSelector({ 
  value, 
  onChange, 
  stemMashupAvailable = false 
}: MixModeSelectorProps) {
  const modes = [
    {
      id: 'standard' as MixMode,
      icon: Music2,
      title: 'Standard Mix',
      description: 'Layer full tracks',
      disabled: false,
    },
    {
      id: 'stem_mashup' as MixMode,
      icon: Mic2,
      title: 'Stem Mashup',
      description: stemMashupAvailable ? 'Vocals + Instrumental' : 'Temporarily unavailable',
      disabled: !stemMashupAvailable,
    },
    {
      id: 'auto_dj' as MixMode,
      icon: Zap,
      title: 'Auto DJ',
      description: 'Event-ready mix',
      disabled: false,
    },
  ];

  return (
    <Card className="bg-card/60 backdrop-blur-xl border-white/10">
      <CardContent className="pt-6 space-y-3">
        <p className="text-sm text-gray-400">Mix Mode</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {modes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => !mode.disabled && onChange(mode.id)}
              disabled={mode.disabled}
              className={`p-4 rounded-lg border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                value === mode.id
                  ? 'border-primary bg-primary/10 text-white'
                  : mode.disabled
                    ? 'border-white/5 text-gray-600 opacity-60 cursor-not-allowed'
                    : 'border-white/10 hover:border-white/20 text-gray-400'
              }`}
              aria-pressed={value === mode.id}
            >
              <mode.icon className="w-5 h-5 mx-auto mb-2" aria-hidden="true" />
              <p className="text-sm font-medium">{mode.title}</p>
              <p className="text-xs text-gray-500">{mode.description}</p>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
