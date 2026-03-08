'use client';

import { useMemo } from 'react';
import { Zap, Battery, BatteryMedium, BatteryFull } from 'lucide-react';

interface EnergySliderProps {
  value: number; // 0-100
  onChange: (value: number) => void;
  disabled?: boolean;
  showPreview?: boolean;
}

export function EnergySlider({ value, onChange, disabled, showPreview = true }: EnergySliderProps) {
  const energyLabel = useMemo(() => {
    if (value <= 25) return { label: 'Low Energy', icon: Battery, color: 'text-blue-500' };
    if (value <= 50) return { label: 'Medium Energy', icon: BatteryMedium, color: 'text-yellow-500' };
    if (value <= 75) return { label: 'High Energy', icon: BatteryFull, color: 'text-orange-500' };
    return { label: 'Very High Energy', icon: Zap, color: 'text-red-500' };
  }, [value]);

  const Icon = energyLabel.icon;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${energyLabel.color}`} />
          <span className="font-medium text-gray-900">{energyLabel.label}</span>
        </div>
        <span className="text-sm text-gray-500">{value}%</span>
      </div>

      <div className="relative">
        <input
          type="range"
          min="0"
          max="100"
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          disabled={disabled}
          className="
            w-full h-3 rounded-lg appearance-none cursor-pointer
            bg-gradient-to-r from-blue-400 via-yellow-400 to-red-500
            disabled:opacity-50 disabled:cursor-not-allowed
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-6
            [&::-webkit-slider-thumb]:h-6
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-white
            [&::-webkit-slider-thumb]:shadow-lg
            [&::-webkit-slider-thumb]:border-2
            [&::-webkit-slider-thumb]:border-gray-200
            [&::-webkit-slider-thumb]:transition-transform
            [&::-webkit-slider-thumb]:hover:scale-110
            [&::-moz-range-thumb]:w-6
            [&::-moz-range-thumb]:h-6
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-white
            [&::-moz-range-thumb]:shadow-lg
            [&::-moz-range-thumb]:border-2
            [&::-moz-range-thumb]:border-gray-200
            [&::-moz-range-thumb]:transition-transform
            [&::-moz-range-thumb]:hover:scale-110
          "
        />
      </div>

      <div className="flex justify-between text-xs text-gray-500">
        <span>Chill</span>
        <span>Moderate</span>
        <span>Energetic</span>
        <span>Intense</span>
      </div>

      {showPreview && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600 mb-2">
            <strong>What to expect:</strong>
          </p>
          <p className="text-sm text-gray-600">
            {getEnergyDescription(value)}
          </p>
        </div>
      )}
    </div>
  );
}

function getEnergyDescription(value: number): string {
  if (value <= 25) {
    return 'A relaxed mix perfect for background listening, studying, or unwinding. Tracks will flow smoothly with gentle transitions.';
  }
  if (value <= 50) {
    return 'A balanced mix with moderate energy. Good for casual listening, working, or social gatherings where music complements the atmosphere.';
  }
  if (value <= 75) {
    return 'An energetic mix that keeps things moving. Great for workouts, driving, or getting motivated. Expect noticeable energy between tracks.';
  }
  return 'A high-intensity mix with powerful transitions. Perfect for parties, intense workouts, or when you need maximum energy.';
}
