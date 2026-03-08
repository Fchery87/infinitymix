'use client';

import { CheckCircle, AlertCircle, Info } from 'lucide-react';
import type { PlannedTransition } from '@/lib/audio/types/planner';

interface RecommendationRationaleProps {
  transition: PlannedTransition;
  format?: 'simple' | 'detailed';
}

export function RecommendationRationale({ 
  transition, 
  format = 'simple' 
}: RecommendationRationaleProps) {
  const explanations = generateExplanations(transition);

  if (format === 'simple') {
    return (
      <div className="space-y-2">
        <p className="text-sm text-gray-700">
          {explanations.summary}
        </p>
        <div className="flex flex-wrap gap-2">
          {explanations.goodPoints.map((point, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-1 rounded-full"
            >
              <CheckCircle className="w-3 h-3" />
              {point}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-700">{explanations.summary}</p>
      
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          Why this works
        </h4>
        {explanations.goodPoints.map((point, i) => (
          <div key={i} className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <span className="text-sm text-gray-600">{point}</span>
          </div>
        ))}
      </div>

      {explanations.warnings.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Considerations
          </h4>
          {explanations.warnings.map((warning, i) => (
            <div key={i} className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-gray-600">{warning}</span>
            </div>
          ))}
        </div>
      )}

      <div className="pt-2 border-t border-gray-100">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Info className="w-3 h-3" />
          <span>Compatibility score: {Math.round(transition.compatibilityScore * 100)}%</span>
        </div>
      </div>
    </div>
  );
}

interface Explanations {
  summary: string;
  goodPoints: string[];
  warnings: string[];
}

function generateExplanations(transition: PlannedTransition): Explanations {
  const goodPoints: string[] = [];
  const warnings: string[] = [];

  // Tempo compatibility
  if (transition.targetBpm) {
    const bpmDiff = Math.abs(transition.targetBpm - (transition.targetBpm || 120));
    if (bpmDiff < 5) {
      goodPoints.push('Similar tempo creates a smooth flow');
    } else if (bpmDiff < 10) {
      goodPoints.push('Tempos are close enough for a natural transition');
    } else {
      warnings.push('Different tempos required adjustment');
    }
  }

  // Transition style
  const styleDescriptions: Record<string, string> = {
    'smooth': 'Classic smooth fade between tracks',
    'cut': 'Clean cut keeps energy high',
    'drop': 'Drop transition adds impact',
    'energy': 'Energy build-up creates excitement',
    'vocal-handoff': 'Vocals flow naturally between tracks',
    'phrase-snap': 'Aligned to musical phrases for perfect timing',
  };

  if (styleDescriptions[transition.transitionStyle]) {
    goodPoints.push(styleDescriptions[transition.transitionStyle]);
  }

  // Stem usage
  if (transition.useStems && transition.stemConfig) {
    goodPoints.push('Using stems for cleaner mixing');
  }

  // Role assignment
  if (transition.fromRole === 'lead-vocal' && transition.toRole === 'lead-instrumental') {
    goodPoints.push('Vocal hands off to instrumental bed');
  } else if (transition.fromRole === 'lead-instrumental' && transition.toRole === 'lead-vocal') {
    goodPoints.push('Instrumental bed supports incoming vocals');
  }

  // Confidence
  if (transition.confidence > 0.8) {
    goodPoints.push('High confidence match');
  } else if (transition.confidence < 0.6) {
    warnings.push('Lower confidence - you may want to review');
  }

  // Overlap duration
  if (transition.overlapDurationSeconds < 2) {
    goodPoints.push('Quick transition keeps momentum');
  } else if (transition.overlapDurationSeconds > 6) {
    goodPoints.push('Extended blend for smooth mixing');
  }

  // Generate summary
  let summary: string;
  if (goodPoints.length >= 3) {
    summary = 'Great match! These tracks work well together with multiple compatibility factors.';
  } else if (goodPoints.length >= 1) {
    summary = 'Good match. These tracks have some nice complementary qualities.';
  } else {
    summary = 'These tracks can work together, but you may want to review the mix.';
  }

  return { summary, goodPoints, warnings };
}
