'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils/helpers';

export type DurationPreset = '1_minute' | '2_minutes' | '3_minutes' | 'custom';

interface DurationPickerProps {
  value: DurationPreset;
  customSeconds?: number;
  onChange: (value: DurationPreset) => void;
  onCustomChange?: (seconds: number) => void;
  className?: string;
}

export function DurationPicker({ value, onChange, customSeconds, onCustomChange, className }: DurationPickerProps) {
  const presets: DurationPreset[] = ['1_minute', '2_minutes', '3_minutes', 'custom'];

  return (
    <Card className={cn("bg-card/60 backdrop-blur-xl", className)}>
      <CardHeader>
        <CardTitle className="flex items-center text-xl">
          <Clock className="w-5 h-5 mr-3 text-primary" />
          Mashup Settings
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div>
          <label className="block text-sm font-medium mb-3 text-gray-400">Target Duration</label>
          <div className="grid grid-cols-4 gap-2">
            {presets.map((preset) => (
              <button
                key={preset}
                onClick={() => onChange(preset)}
                className={cn(
                  "py-3 px-2 rounded-lg text-sm font-medium transition-all duration-200 border",
                  value === preset 
                    ? 'bg-primary text-primary-foreground border-primary shadow-[0_0_15px_rgba(249,115,22,0.4)]' 
                    : 'bg-black/40 text-gray-400 border-white/5 hover:bg-white/5 hover:text-white'
                )}
              >
                {preset === 'custom' ? 'Custom' : preset.replace('_', ' ')}
              </button>
            ))}
          </div>
          {value === 'custom' && (
            <div className="mt-3">
              <label className="text-xs text-gray-400">Custom duration (seconds)</label>
              <input
                type="number"
                min={15}
                step={15}
                value={customSeconds ?? ''}
                onChange={(e) => onCustomChange?.(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-primary"
                placeholder="e.g. 180"
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
