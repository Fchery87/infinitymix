'use client';

import { PartyPopper, TrendingUp, Coffee, Sunrise, Moon, Activity } from 'lucide-react';
import type { EventArchetype } from '@/lib/audio/types/planner';

interface EventTypeOption {
  id: EventArchetype;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  energyCurve: 'steady' | 'build' | 'wave' | 'peak' | 'valley';
  examples: string[];
  color: string;
}

const EVENT_TYPES: EventTypeOption[] = [
  {
    id: 'party-peak',
    name: 'Party Mix',
    description: 'High energy throughout, perfect for dancing and celebration',
    icon: PartyPopper,
    energyCurve: 'peak',
    examples: ['House party', 'Club night', 'Birthday celebration'],
    color: 'from-pink-500 to-rose-500',
  },
  {
    id: 'warmup-journey',
    name: 'Journey Mix',
    description: 'Builds from chill to energetic, great for activities',
    icon: TrendingUp,
    energyCurve: 'build',
    examples: ['Workout', 'Road trip', 'Getting ready'],
    color: 'from-orange-500 to-amber-500',
  },
  {
    id: 'chill-vibe',
    name: 'Chill Mix',
    description: 'Relaxed and steady, perfect for background listening',
    icon: Coffee,
    energyCurve: 'steady',
    examples: ['Study session', 'Relaxing', 'Working'],
    color: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'sunrise-set',
    name: 'Sunrise Set',
    description: 'Starts mellow, builds to a peak, then settles',
    icon: Sunrise,
    energyCurve: 'wave',
    examples: ['Morning routine', 'Yoga', 'Beach day'],
    color: 'from-yellow-400 to-orange-400',
  },
  {
    id: 'peak-valley',
    name: 'Dynamic Mix',
    description: 'Alternates between high and low energy',
    icon: Activity,
    energyCurve: 'valley',
    examples: ['Variety listening', 'Mood changes', 'Playlist'],
    color: 'from-purple-500 to-violet-500',
  },
];

interface EventTypeSelectorProps {
  value: EventArchetype | null;
  onChange: (value: EventArchetype) => void;
  disabled?: boolean;
}

export function EventTypeSelector({ value, onChange, disabled }: EventTypeSelectorProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {EVENT_TYPES.map((eventType) => {
        const Icon = eventType.icon;
        const isSelected = value === eventType.id;
        
        return (
          <button
            key={eventType.id}
            onClick={() => onChange(eventType.id)}
            disabled={disabled}
            className={`
              relative p-6 rounded-xl border-2 text-left transition-all duration-200
              hover:shadow-lg hover:scale-[1.02]
              disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
              ${isSelected 
                ? `border-transparent bg-gradient-to-br ${eventType.color} text-white shadow-lg` 
                : 'border-gray-200 bg-white hover:border-gray-300 text-gray-900'
              }
            `}
          >
            <div className="flex items-start gap-4">
              <div className={`
                p-3 rounded-lg 
                ${isSelected ? 'bg-white/20' : 'bg-gray-100'}
              `}>
                <Icon className={`w-6 h-6 ${isSelected ? 'text-white' : 'text-gray-600'}`} />
              </div>
              
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">
                  {eventType.name}
                </h3>
                <p className={`text-sm mb-3 ${isSelected ? 'text-white/90' : 'text-gray-600'}`}>
                  {eventType.description}
                </p>
                
                <div className="flex flex-wrap gap-2">
                  {eventType.examples.map((example) => (
                    <span
                      key={example}
                      className={`
                        text-xs px-2 py-1 rounded-full
                        ${isSelected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}
                      `}
                    >
                      {example}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            
            {isSelected && (
              <div className="absolute top-3 right-3">
                <div className="w-6 h-6 rounded-full bg-white/30 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function getEventTypeName(id: EventArchetype): string {
  return EVENT_TYPES.find(e => e.id === id)?.name || id;
}

export function getEventTypeDescription(id: EventArchetype): string {
  return EVENT_TYPES.find(e => e.id === id)?.description || '';
}
