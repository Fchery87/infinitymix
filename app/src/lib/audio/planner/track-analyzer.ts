/**
 * Track Analysis Utilities
 * 
 * Helper functions for analyzing track features
 * and calculating energy/vocal characteristics.
 */

import type { TrackPlanningSummary } from '@/lib/audio/types/planner';

/**
 * Calculate energy profile from waveform and structure data
 */
export function calculateEnergyProfile(
  waveformLite: number[] | null,
  analysisFeatures: Record<string, unknown> | null,
  structure: Array<{ label: string; start: number; end: number; confidence: number; provenance: string }>
): TrackPlanningSummary['energyProfile'] {
  // Default values
  let averageEnergy = 0.5;
  let peakEnergy = 0.7;
  let valleyEnergy = 0.3;
  let energyVariance = 0.2;

  // Try to extract from waveform if available
  if (waveformLite && waveformLite.length > 0) {
    const values = waveformLite.map(v => Math.abs(v));
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const max = Math.max(...values);
    const min = Math.min(...values);
    
    // Normalize to 0-1 range
    averageEnergy = Math.min(1, Math.max(0, avg * 2));
    peakEnergy = Math.min(1, Math.max(0, max * 2));
    valleyEnergy = Math.min(1, Math.max(0, min * 2));
    
    // Calculate variance
    const variance = values.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / values.length;
    energyVariance = Math.min(1, variance * 10);
  }

  // Adjust based on structure labels
  if (structure.length > 0) {
    const hasBuild = structure.some(s => s.label === 'build');
    const hasDrop = structure.some(s => s.label === 'drop');
    
    if (hasBuild && hasDrop) {
      energyVariance = Math.max(energyVariance, 0.4);
      peakEnergy = Math.max(peakEnergy, 0.8);
    }
  }

  // Try to get from analysis features descriptors
  const descriptors = analysisFeatures?.descriptors as Record<string, number> | undefined;
  if (descriptors?.energy != null) {
    averageEnergy = Math.min(1, Math.max(0, descriptors.energy));
  }
  if (descriptors?.rms != null) {
    // RMS is a good proxy for overall energy
    const rmsNormalized = Math.min(1, descriptors.rms * 3);
    averageEnergy = (averageEnergy + rmsNormalized) / 2;
  }

  return {
    averageEnergy: Number(averageEnergy.toFixed(3)),
    peakEnergy: Number(peakEnergy.toFixed(3)),
    valleyEnergy: Number(valleyEnergy.toFixed(3)),
    energyVariance: Number(energyVariance.toFixed(3)),
  };
}

/**
 * Calculate vocal dominance score (0 = instrumental, 1 = vocal)
 */
export function calculateVocalDominance(
  analysisFeatures: Record<string, unknown> | null,
  structure: Array<{ label: string; start: number; end: number; confidence: number; provenance: string }>
): number {
  let vocalScore = 0.5; // Default: neutral

  // Check for vocal-dominant tags in analysis features
  const sectionTagging = analysisFeatures?.sectionTagging as Record<string, unknown> | undefined;
  const tags = sectionTagging?.tags as Array<{ tag: string; confidence: number }> | undefined;
  
  if (tags) {
    const vocalTags = tags.filter(t => t.tag === 'vocal-dominant');
    if (vocalTags.length > 0) {
      const avgConfidence = vocalTags.reduce((acc, t) => acc + t.confidence, 0) / vocalTags.length;
      vocalScore = 0.5 + avgConfidence * 0.5;
    }
  }

  // Check structure labels
  const vocalSections = structure.filter(s => 
    s.label.includes('vocal') || s.label.includes('verse') || s.label.includes('chorus')
  );
  const totalDuration = structure.reduce((acc, s) => acc + (s.end - s.start), 0);
  const vocalDuration = vocalSections.reduce((acc, s) => acc + (s.end - s.start), 0);
  
  if (totalDuration > 0) {
    const vocalRatio = vocalDuration / totalDuration;
    vocalScore = vocalScore * 0.5 + vocalRatio * 0.5;
  }

  // Use spectral features as proxy
  const descriptors = analysisFeatures?.descriptors as Record<string, number> | undefined;
  if (descriptors?.spectralCentroid != null) {
    // Higher centroid often correlates with vocal presence
    const centroidNormalized = Math.min(1, descriptors.spectralCentroid / 8000);
    vocalScore = vocalScore * 0.7 + centroidNormalized * 0.3;
  }

  return Number(vocalScore.toFixed(3));
}

/**
 * Get the best cue point of a specific type
 */
export function getBestCuePoint(
  track: TrackPlanningSummary,
  type: 'mix-in' | 'mix-out' | 'drop' | 'breakdown'
): { position: number; confidence: number } | null {
  const cues = track.cuePoints.filter(cp => cp.type === type);
  if (cues.length === 0) return null;
  
  // Return the highest confidence cue
  return cues.reduce((best, cue) => 
    cue.confidence > best.confidence ? cue : best
  );
}

/**
 * Get energy at a specific time in a track
 */
export function getEnergyAtTime(
  track: TrackPlanningSummary,
  timeSeconds: number
): number {
  // Check if within a specific structure section
  const section = track.structure.find(s => 
    timeSeconds >= s.start && timeSeconds <= s.end
  );
  
  if (section) {
    return section.energy ?? track.energyProfile.averageEnergy;
  }
  
  // Default to average energy
  return track.energyProfile.averageEnergy;
}
