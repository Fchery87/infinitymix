import type { PreviewTransitionStyle } from '@/lib/audio/preview-graph';
import type { TransitionExecutionContract } from '@/lib/audio/types/transition';

export type PreviewRenderAuthority = 'render-authoritative' | 'preview-only';

export type PreviewRenderControlMapping = {
  previewControl: string;
  renderSetting: string | null;
  authority: PreviewRenderAuthority;
  notes: string;
};

export type PreviewRenderParityEntry = {
  style: PreviewTransitionStyle;
  renderPresetDurationSeconds: number;
  previewEffects: string[];
  previewOnlyFx: string[];
  renderAuthoritativeOutputs: string[];
  controlMappings: PreviewRenderControlMapping[];
};

export const PREVIEW_RENDER_PARITY: Record<PreviewTransitionStyle, PreviewRenderParityEntry> = {
  smooth: {
    style: 'smooth',
    renderPresetDurationSeconds: 4,
    previewEffects: ['crossfade'],
    previewOnlyFx: [],
    renderAuthoritativeOutputs: ['ffmpeg acrossfade curves'],
    controlMappings: [
      {
        previewControl: 'durationSeconds',
        renderSetting: 'fadeDurationSeconds',
        authority: 'render-authoritative',
        notes: 'Preview duration should mirror the backend fade duration.',
      },
    ],
  },
  drop: {
    style: 'drop',
    renderPresetDurationSeconds: 0.5,
    previewEffects: ['crossfade', 'low-pass sweep'],
    previewOnlyFx: [],
    renderAuthoritativeOutputs: ['transitionStyle=drop', 'fadeDurationSeconds'],
    controlMappings: [
      {
        previewControl: 'durationSeconds',
        renderSetting: 'fadeDurationSeconds',
        authority: 'render-authoritative',
        notes: 'Preview uses a short drop envelope aligned to backend drop duration.',
      },
      {
        previewControl: 'filterSweep.fromHz/toHz',
        renderSetting: 'transitionStyle',
        authority: 'render-authoritative',
        notes: 'Filter motion previews the backend drop contour rather than setting direct FFmpeg frequencies.',
      },
    ],
  },
  energy: {
    style: 'energy',
    renderPresetDurationSeconds: 2,
    previewEffects: ['crossfade', 'delay send', 'reverb send'],
    previewOnlyFx: [],
    renderAuthoritativeOutputs: ['transitionStyle=energy', 'fadeDurationSeconds'],
    controlMappings: [
      {
        previewControl: 'durationSeconds',
        renderSetting: 'fadeDurationSeconds',
        authority: 'render-authoritative',
        notes: 'Energy transitions keep duration parity with the render preset.',
      },
      {
        previewControl: 'delay/reverb sends',
        renderSetting: 'transitionStyle',
        authority: 'render-authoritative',
        notes: 'Wet FX preview the energy transition character but render remains preset-driven.',
      },
    ],
  },
  cut: {
    style: 'cut',
    renderPresetDurationSeconds: 0,
    previewEffects: ['hard crossfade jump'],
    previewOnlyFx: [],
    renderAuthoritativeOutputs: ['transitionStyle=cut'],
    controlMappings: [
      {
        previewControl: 'crossfadeCurve=cut',
        renderSetting: 'transitionStyle',
        authority: 'render-authoritative',
        notes: 'Cut preview is a direct proxy for the backend no-fade transition.',
      },
    ],
  },
  filter_sweep: {
    style: 'filter_sweep',
    renderPresetDurationSeconds: 4,
    previewEffects: ['crossfade', 'band-limited sweep'],
    previewOnlyFx: [],
    renderAuthoritativeOutputs: ['transitionStyle=filter_sweep', 'enableFilterSweep', 'fadeDurationSeconds'],
    controlMappings: [
      {
        previewControl: 'durationSeconds',
        renderSetting: 'fadeDurationSeconds',
        authority: 'render-authoritative',
        notes: 'Preview sweep spans the same transition window as the backend.',
      },
      {
        previewControl: 'filterSweep',
        renderSetting: 'enableFilterSweep',
        authority: 'render-authoritative',
        notes: 'Preview sweep indicates that the backend filter sweep path should be enabled.',
      },
    ],
  },
  echo_reverb: {
    style: 'echo_reverb',
    renderPresetDurationSeconds: 3,
    previewEffects: ['crossfade', 'delay send', 'reverb send'],
    previewOnlyFx: [],
    renderAuthoritativeOutputs: ['transitionStyle=echo_reverb', 'fadeDurationSeconds'],
    controlMappings: [
      {
        previewControl: 'delay/reverb sends',
        renderSetting: 'transitionStyle',
        authority: 'render-authoritative',
        notes: 'Preview send levels illustrate the preset flavor; backend remains style-driven.',
      },
      {
        previewControl: 'durationSeconds',
        renderSetting: 'fadeDurationSeconds',
        authority: 'render-authoritative',
        notes: 'Echo/reverb preview duration should match backend fade duration.',
      },
    ],
  },
  backspin: {
    style: 'backspin',
    renderPresetDurationSeconds: 1,
    previewEffects: ['crossfade', 'playback-rate ramp'],
    previewOnlyFx: ['Tone.Player.playbackRate ramp'],
    renderAuthoritativeOutputs: ['transitionStyle=backspin', 'fadeDurationSeconds'],
    controlMappings: [
      {
        previewControl: 'playbackRateRamp',
        renderSetting: null,
        authority: 'preview-only',
        notes: 'Tone.js playback-rate modulation previews the feel of a backspin but is not a direct backend parameter.',
      },
      {
        previewControl: 'durationSeconds',
        renderSetting: 'fadeDurationSeconds',
        authority: 'render-authoritative',
        notes: 'Transition timing still maps to the backend fade duration.',
      },
    ],
  },
  tape_stop: {
    style: 'tape_stop',
    renderPresetDurationSeconds: 1.5,
    previewEffects: ['crossfade', 'playback-rate ramp'],
    previewOnlyFx: ['Tone.Player.playbackRate ramp'],
    renderAuthoritativeOutputs: ['transitionStyle=tape_stop', 'fadeDurationSeconds'],
    controlMappings: [
      {
        previewControl: 'playbackRateRamp',
        renderSetting: null,
        authority: 'preview-only',
        notes: 'Playback-rate slowdown is preview-only and approximates the backend tape-stop style.',
      },
      {
        previewControl: 'durationSeconds',
        renderSetting: 'fadeDurationSeconds',
        authority: 'render-authoritative',
        notes: 'Transition timing remains render-authoritative.',
      },
    ],
  },
  stutter_edit: {
    style: 'stutter_edit',
    renderPresetDurationSeconds: 1,
    previewEffects: ['crossfade'],
    previewOnlyFx: [],
    renderAuthoritativeOutputs: ['transitionStyle=stutter_edit', 'fadeDurationSeconds'],
    controlMappings: [
      {
        previewControl: 'durationSeconds',
        renderSetting: 'fadeDurationSeconds',
        authority: 'render-authoritative',
        notes: 'Preview duration maps to backend stutter transition timing.',
      },
    ],
  },
  three_band_swap: {
    style: 'three_band_swap',
    renderPresetDurationSeconds: 2.5,
    previewEffects: ['crossfade'],
    previewOnlyFx: [],
    renderAuthoritativeOutputs: ['transitionStyle=three_band_swap', 'fadeDurationSeconds'],
    controlMappings: [
      {
        previewControl: 'durationSeconds',
        renderSetting: 'fadeDurationSeconds',
        authority: 'render-authoritative',
        notes: 'Preview timing mirrors the backend multiband transition window.',
      },
    ],
  },
  bass_drop: {
    style: 'bass_drop',
    renderPresetDurationSeconds: 1.25,
    previewEffects: ['crossfade', 'low-pass sweep'],
    previewOnlyFx: [],
    renderAuthoritativeOutputs: ['transitionStyle=bass_drop', 'fadeDurationSeconds'],
    controlMappings: [
      {
        previewControl: 'filterSweep.fromHz/toHz',
        renderSetting: 'transitionStyle',
        authority: 'render-authoritative',
        notes: 'Preview bass filtering represents the backend bass-drop preset contour.',
      },
      {
        previewControl: 'durationSeconds',
        renderSetting: 'fadeDurationSeconds',
        authority: 'render-authoritative',
        notes: 'Preview duration is kept aligned with render timing.',
      },
    ],
  },
  snare_roll: {
    style: 'snare_roll',
    renderPresetDurationSeconds: 2,
    previewEffects: ['crossfade', 'delay send', 'reverb send'],
    previewOnlyFx: [],
    renderAuthoritativeOutputs: ['transitionStyle=snare_roll', 'fadeDurationSeconds'],
    controlMappings: [
      {
        previewControl: 'delay/reverb sends',
        renderSetting: 'transitionStyle',
        authority: 'render-authoritative',
        notes: 'Preview FX characterize the snare-roll preset, but the backend owns the final transition design.',
      },
      {
        previewControl: 'durationSeconds',
        renderSetting: 'fadeDurationSeconds',
        authority: 'render-authoritative',
        notes: 'Preview timing mirrors the backend snare-roll duration.',
      },
    ],
  },
  noise_riser: {
    style: 'noise_riser',
    renderPresetDurationSeconds: 3,
    previewEffects: ['crossfade', 'reverb send'],
    previewOnlyFx: [],
    renderAuthoritativeOutputs: ['transitionStyle=noise_riser', 'fadeDurationSeconds'],
    controlMappings: [
      {
        previewControl: 'reverbSend',
        renderSetting: 'transitionStyle',
        authority: 'render-authoritative',
        notes: 'Preview reverb growth represents the riser style rather than a direct backend numeric control.',
      },
      {
        previewControl: 'durationSeconds',
        renderSetting: 'fadeDurationSeconds',
        authority: 'render-authoritative',
        notes: 'Preview timing stays aligned with backend transition length.',
      },
    ],
  },
  vocal_handoff: {
    style: 'vocal_handoff',
    renderPresetDurationSeconds: 2.5,
    previewEffects: ['crossfade'],
    previewOnlyFx: [],
    renderAuthoritativeOutputs: ['transitionStyle=vocal_handoff', 'fadeDurationSeconds'],
    controlMappings: [
      {
        previewControl: 'crossfadeCurve',
        renderSetting: 'transitionStyle',
        authority: 'render-authoritative',
        notes: 'Preview handoff curve represents the backend vocal-handoff preset.',
      },
      {
        previewControl: 'durationSeconds',
        renderSetting: 'fadeDurationSeconds',
        authority: 'render-authoritative',
        notes: 'Preview timing maps directly to render fade duration.',
      },
    ],
  },
  bass_swap: {
    style: 'bass_swap',
    renderPresetDurationSeconds: 2,
    previewEffects: ['crossfade'],
    previewOnlyFx: [],
    renderAuthoritativeOutputs: ['transitionStyle=bass_swap', 'fadeDurationSeconds'],
    controlMappings: [
      {
        previewControl: 'crossfadeCurve',
        renderSetting: 'transitionStyle',
        authority: 'render-authoritative',
        notes: 'Preview bass-swap shape is illustrative of the backend preset.',
      },
      {
        previewControl: 'durationSeconds',
        renderSetting: 'fadeDurationSeconds',
        authority: 'render-authoritative',
        notes: 'Preview timing maps directly to render fade duration.',
      },
    ],
  },
  reverb_wash: {
    style: 'reverb_wash',
    renderPresetDurationSeconds: 3.5,
    previewEffects: ['crossfade', 'reverb send'],
    previewOnlyFx: [],
    renderAuthoritativeOutputs: ['transitionStyle=reverb_wash', 'fadeDurationSeconds'],
    controlMappings: [
      {
        previewControl: 'reverbSend',
        renderSetting: 'transitionStyle',
        authority: 'render-authoritative',
        notes: 'Preview wetness represents the wash-style preset, not a direct backend scalar.',
      },
      {
        previewControl: 'durationSeconds',
        renderSetting: 'fadeDurationSeconds',
        authority: 'render-authoritative',
        notes: 'Preview timing should remain aligned with backend duration.',
      },
    ],
  },
  echo_out: {
    style: 'echo_out',
    renderPresetDurationSeconds: 2.5,
    previewEffects: ['crossfade', 'delay send', 'reverb send'],
    previewOnlyFx: [],
    renderAuthoritativeOutputs: ['transitionStyle=echo_out', 'fadeDurationSeconds'],
    controlMappings: [
      {
        previewControl: 'delay/reverb sends',
        renderSetting: 'transitionStyle',
        authority: 'render-authoritative',
        notes: 'Preview send levels describe the echo-out flavor while backend rendering remains style-driven.',
      },
      {
        previewControl: 'durationSeconds',
        renderSetting: 'fadeDurationSeconds',
        authority: 'render-authoritative',
        notes: 'Preview timing maps directly to backend transition timing.',
      },
    ],
  },
};

export function listPreviewRenderParity(): PreviewRenderParityEntry[] {
  return Object.values(PREVIEW_RENDER_PARITY);
}

// ============================================================================
// Phase 4: Transition Execution Contract Mappings
// ============================================================================

/**
 * Maps TransitionExecutionContract fields to preview and render behavior.
 * 
 * This documentation explains how the shared contract drives both preview
 * and render, clarifying which behaviors are preview-only vs render-authoritative.
 */

export type ContractFieldAuthority = {
  field: keyof TransitionExecutionContract;
  previewBehavior: string;
  renderBehavior: string;
  authority: 'preview-only' | 'render-authoritative' | 'shared';
  notes: string;
};

export const CONTRACT_FIELD_MAPPINGS: ContractFieldAuthority[] = [
  {
    field: 'trackAId',
    previewBehavior: 'Load track A audio into Tone.js player',
    renderBehavior: 'Load track A audio into FFmpeg input',
    authority: 'shared',
    notes: 'Both use the same track ID from the contract.',
  },
  {
    field: 'trackBId',
    previewBehavior: 'Load track B audio into Tone.js player',
    renderBehavior: 'Load track B audio into FFmpeg input',
    authority: 'shared',
    notes: 'Both use the same track ID from the contract.',
  },
  {
    field: 'trackARole',
    previewBehavior: 'Determines if track A plays as vocal, instrumental, or full mix',
    renderBehavior: 'Determines stem selection for track A (if stems available)',
    authority: 'shared',
    notes: 'Role affects both preview and render track selection.',
  },
  {
    field: 'trackBRole',
    previewBehavior: 'Determines if track B plays as vocal, instrumental, or full mix',
    renderBehavior: 'Determines stem selection for track B (if stems available)',
    authority: 'shared',
    notes: 'Role affects both preview and render track selection.',
  },
  {
    field: 'mixOutCueSeconds',
    previewBehavior: 'Start crossfade from this position in track A',
    renderBehavior: 'Start transition from this position in track A',
    authority: 'shared',
    notes: 'Critical timing parameter - must match exactly.',
  },
  {
    field: 'mixInCueSeconds',
    previewBehavior: 'Start track B from this position',
    renderBehavior: 'Start track B from this position',
    authority: 'shared',
    notes: 'Critical timing parameter - must match exactly.',
  },
  {
    field: 'overlapDurationSeconds',
    previewBehavior: 'Duration of crossfade in seconds',
    renderBehavior: 'Duration of transition fade in seconds',
    authority: 'shared',
    notes: 'Preview and render should use the same duration.',
  },
  {
    field: 'tempoRampStrategy',
    previewBehavior: 'Adjust Tone.js playback rate (approximate)',
    renderBehavior: 'Apply FFmpeg rubberband or atempo filter',
    authority: 'render-authoritative',
    notes: 'Preview tempo ramp is approximate; render is precise.',
  },
  {
    field: 'targetBpm',
    previewBehavior: 'Target playback rate for preview',
    renderBehavior: 'Target tempo for time-stretching',
    authority: 'render-authoritative',
    notes: 'Preview may not apply exact tempo; render is precise.',
  },
  {
    field: 'trackAEqIntent',
    previewBehavior: 'Apply Tone.js EQ/filter (approximate)',
    renderBehavior: 'Apply FFmpeg audio filters (precise)',
    authority: 'render-authoritative',
    notes: 'Preview EQ indicates intent; render applies actual filters.',
  },
  {
    field: 'trackBEqIntent',
    previewBehavior: 'Apply Tone.js EQ/filter (approximate)',
    renderBehavior: 'Apply FFmpeg audio filters (precise)',
    authority: 'render-authoritative',
    notes: 'Preview EQ indicates intent; render applies actual filters.',
  },
  {
    field: 'transitionStyle',
    previewBehavior: 'Select preview preset (crossfade curve, FX)',
    renderBehavior: 'Select render preset (fade curves, processing)',
    authority: 'shared',
    notes: 'Both use the same style identifier from the contract.',
  },
];

/**
 * Get authority classification for a specific contract field
 */
export function getContractFieldAuthority(
  field: keyof TransitionExecutionContract
): ContractFieldAuthority | undefined {
  return CONTRACT_FIELD_MAPPINGS.find((m) => m.field === field);
}

/**
 * Validate that a contract is suitable for both preview and render
 */
export function validateContractParity(
  contract: TransitionExecutionContract
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  // Critical fields must be present
  const criticalFields: (keyof TransitionExecutionContract)[] = [
    'trackAId',
    'trackBId',
    'mixOutCueSeconds',
    'mixInCueSeconds',
    'overlapDurationSeconds',
    'transitionStyle',
  ];

  for (const field of criticalFields) {
    if (contract[field] === undefined || contract[field] === null) {
      issues.push(`Missing critical field: ${field}`);
    }
  }

  // Validate timing
  if (contract.mixOutCueSeconds !== undefined && contract.mixOutCueSeconds < 0) {
    issues.push('mixOutCueSeconds cannot be negative');
  }

  if (contract.mixInCueSeconds !== undefined && contract.mixInCueSeconds < 0) {
    issues.push('mixInCueSeconds cannot be negative');
  }

  if (contract.overlapDurationSeconds <= 0) {
    issues.push('overlapDurationSeconds must be positive');
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
