'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils/helpers';

export type DurationPreset = '1_minute' | '2_minutes' | '3_minutes';

interface DurationPickerProps {
  value: DurationPreset;
  onChange: (value: DurationPreset) => void;
  className?: string;
}

export function DurationPicker({ value, onChange, className }: DurationPickerProps) {
  const presets: DurationPreset[] = ['1_minute', '2_minutes', '3_minutes'];

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
          <div className="grid grid-cols-3 gap-2">
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
                {preset.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
