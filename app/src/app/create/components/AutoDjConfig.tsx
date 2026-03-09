// src/app/create/components/AutoDjConfig.tsx
'use client';

import { Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { EventTypeSelector } from '@/components/create';
import { EnergySlider } from '@/components/create';
import type { EventArchetype, TransitionStyle } from '@/lib/audio/types/planner';

interface AutoDjConfigProps {
  energyLevel: number;
  eventType: EventArchetype;
  autoDjTargetBpm: number | null;
  autoDjTransitionStyle: TransitionStyle;
  preferStems: boolean;
  keepOrder: boolean;
  onEnergyLevelChange: (level: number) => void;
  onEventTypeChange: (type: EventArchetype) => void;
  onTargetBpmChange: (bpm: number | null) => void;
  onTransitionStyleChange: (style: TransitionStyle) => void;
  onPreferStemsChange: (prefer: boolean) => void;
  onKeepOrderChange: (keep: boolean) => void;
}

export function AutoDjConfig({
  energyLevel,
  eventType,
  autoDjTargetBpm,
  autoDjTransitionStyle,
  preferStems,
  keepOrder,
  onEnergyLevelChange,
  onEventTypeChange,
  onTargetBpmChange,
  onTransitionStyleChange,
  onPreferStemsChange,
  onKeepOrderChange,
}: AutoDjConfigProps) {
  return (
    <Card className="bg-card/60 backdrop-blur-xl border-primary/20">
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" aria-hidden="true" />
          <p className="text-sm font-medium text-white">Auto DJ Configuration</p>
        </div>

        {/* Event Type */}
        <div>
          <label className="text-xs text-gray-400 mb-2 block">Event Type</label>
          <EventTypeSelector
            value={eventType}
            onChange={onEventTypeChange}
          />
        </div>

        {/* Energy Level */}
        <div>
          <label className="text-xs text-gray-400 mb-2 block">Energy Level</label>
          <EnergySlider
            value={energyLevel}
            onChange={onEnergyLevelChange}
          />
        </div>

        {/* Target BPM */}
        <div>
          <label htmlFor="target-bpm" className="text-xs text-gray-400 mb-2 block">
            Target BPM (optional)
          </label>
          <input
            id="target-bpm"
            type="number"
            min={60}
            max={200}
            value={autoDjTargetBpm || ''}
            onChange={(e) => onTargetBpmChange(e.target.value ? Number(e.target.value) : null)}
            placeholder="Auto-detect"
            className="w-full p-3 rounded-lg bg-black/30 border border-white/10 text-white text-sm focus:border-primary outline-none"
          />
        </div>

        {/* Transition Style */}
        <div>
          <label htmlFor="transition-style" className="text-xs text-gray-400 mb-2 block">
            Transition Style
          </label>
          <select
            id="transition-style"
            value={autoDjTransitionStyle}
            onChange={(e) => onTransitionStyleChange(e.target.value as TransitionStyle)}
            className="w-full p-3 rounded-lg bg-black/30 border border-white/10 text-white text-sm focus:border-primary outline-none"
          >
            <option value="smooth">Smooth</option>
            <option value="energetic">Energetic</option>
            <option value="minimal">Minimal</option>
          </select>
        </div>

        {/* Prefer Stems */}
        <label className="flex items-center gap-3 p-3 rounded-lg bg-black/20 border border-white/5 cursor-pointer hover:border-white/10">
          <input
            type="checkbox"
            checked={preferStems}
            onChange={(e) => onPreferStemsChange(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          <div>
            <p className="text-sm text-white">Prefer stems when available</p>
            <p className="text-xs text-gray-500">Use separated stems for smoother transitions</p>
          </div>
        </label>

        {/* Keep Order */}
        <label className="flex items-center gap-3 p-3 rounded-lg bg-black/20 border border-white/5 cursor-pointer hover:border-white/10">
          <input
            type="checkbox"
            checked={keepOrder}
            onChange={(e) => onKeepOrderChange(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          <div>
            <p className="text-sm text-white">Maintain track order</p>
            <p className="text-xs text-gray-500">Don&apos;t reorder tracks for optimal flow</p>
          </div>
        </label>
      </CardContent>
    </Card>
  );
}
