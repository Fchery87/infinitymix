/**
 * API Route: Auto DJ Mix - Updated with New Features
 * 
 * This file should be merged with the existing:
 * app/src/app/api/mashups/djmix/route.ts
 * 
 * Additions:
 * - Advanced transition styles
 * - Sidechain ducking option
 * - Multiband compression option
 * - Per-stem mixing support
 */

import { NextRequest, NextResponse } from 'next/server';
import { log } from '@/lib/logger';
import { logTelemetry } from '@/lib/telemetry';
import { renderAutoDjMix, type AutoDJPlan } from '@/lib/audio/auto-dj-service';
import { mixToBuffer, type MixingConfig } from '@/lib/audio/mixing-service';
import { mixStemsPerTrack, type StemMixingConfig } from '@/lib/audio/stem-mixing-service';
import { normalizeToEBU128 } from '@/lib/audio/audio-normalizer';
import { uploadBufferToStorage } from '@/lib/storage';
import { getMashup, updateMashup, getTrack } from '@/lib/db';

/**
 * POST /api/mashups/djmix
 * 
 * Render an Auto DJ mix with enhanced features.
 */
export async function POST(req: NextRequest) {
  const startedAt = Date.now();

  try {
    // ========================================================================
    // 1. Parse request body
    // ========================================================================
    const body = await req.json();
    const {
      mashupId,
      trackOrder,
      config,
    } = body;

    log('info', 'api.mashups.djmix.start', {
      mashupId,
      trackCount: trackOrder?.length,
      config,
    });

    // ========================================================================
    // 2. Validate input
    // ========================================================================
    if (!mashupId) {
      return NextResponse.json(
        { error: 'mashupId is required' },
        { status: 400 }
      );
    }

    if (!trackOrder || !Array.isArray(trackOrder) || trackOrder.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 tracks are required' },
        { status: 400 }
      );
    }

    const mashup = await getMashup(mashupId);
    if (!mashup) {
      return NextResponse.json(
        { error: 'Mashup not found' },
        { status: 404 }
      );
    }

    // ========================================================================
    // 3. Generate Auto DJ plan
    // ========================================================================
    const plan = await renderAutoDjMix(
      mashup.id,
      trackOrder,
      {
        transitionStyle: config?.transitionStyle || 'smooth',
        fadeOutDuration: config?.fadeOutDuration || 4,
        fadeInDuration: config?.fadeInDuration || 4,
        transitionPoint: config?.transitionPoint || 'auto',
        enableHarmonicMixing: config?.enableHarmonicMixing !== false,
        enableBeatmatching: config?.enableBeatmatching !== false,
        enablePhraseAlignment: config?.enablePhraseAlignment !== false,
      }
    );

    log('info', 'api.mashups.djmix.planGenerated', {
      transitionCount: plan.transitions.length,
      totalDuration: plan.totalDuration,
    });

    // ========================================================================
    // 4. Determine mixing mode
    // ========================================================================
    const usePerStemMixing = config?.usePerStemMixing ?? false;
    const useMultibandCompression = config?.enableMultibandCompression ?? true;
    const useSidechainDucking = config?.enableSidechainDucking ?? true;
    const useDynamicEQ = config?.enableDynamicEQ ?? true;
    const loudnessNormalization = config?.loudnessNormalization ?? 'ebu_r128';

    // ========================================================================
    // 5. Build mixing configuration
    // ========================================================================
    if (usePerStemMixing) {
      // =======================================
      // Mode: Per-Stem Mixing
      // =======================================
      const stemConfig: StemMixingConfig = {
        tracks: [],
        transitions: [],
        processing: {
          enableMultibandCompression: useMultibandCompression,
          enableSidechainDucking: useSidechainDucking,
          enableDynamicEQ: useDynamicEQ,
          loudnessNormalization: loudnessNormalization,
          targetLoudness: config?.targetLoudness || -23,
        },
      };

      // Populate tracks with stems
      for (const trackId of trackOrder) {
        const track = await getTrack(trackId);
        if (!track) continue;

        const stems = await getAllStemBuffers(track.id);
        stemConfig.tracks.push({
          id: track.id,
          bpm: track.bpm,
          stems: {
            vocals: stems.get('vocals') ? { buffer: stems.get('vocals')!.buffer } : undefined,
            drums: stems.get('drums') ? { buffer: stems.get('drums')!.buffer } : undefined,
            bass: stems.get('bass') ? { buffer: stems.get('bass')!.buffer } : undefined,
            other: stems.get('other') ? { buffer: stems.get('other')!.buffer } : undefined,
          },
        });
      }

      // Populate transitions
      for (const transition of plan.transitions) {
        stemConfig.transitions.push({
          fromTrackId: transition.fromTrackId,
          toTrackId: transition.toTrackId,
          style: mapTransitionStyle(transition.style),
          duration: transition.duration,
          crossfadeCurve: transition.style,
        });
      }

      log('info', 'api.mashups.djmix.perStemMode', {
        trackCount: stemConfig.tracks.length,
        transitionsCount: stemConfig.transitions.length,
      });

      // Execute per-stem mixing
      const result = await mixStemsPerTrack(stemConfig, config?.outputDuration);

      // Upload result
      const filename = `djmix-perstem-${mashupId}-${Date.now()}.mp3`;
      const storageUrl = await uploadBufferToStorage(result.buffer, filename, 'audio/mpeg');

      // Update mashup
      await updateMashup(mashupId, {
        mixUrl: storageUrl,
        mixFilename: filename,
        mixingMode: 'per_stem',
        config: {
          ...mashup.config,
          usePerStemMixing: true,
          enableMultibandCompression: useMultibandCompression,
          enableSidechainDucking: useSidechainDucking,
          enableDynamicEQ: useDynamicEQ,
          loudnessNormalization: loudnessNormalization,
        },
        metrics: result.metrics,
        totalDuration: plan.totalDuration,
      });

      return NextResponse.json({
        success: true,
        url: storageUrl,
        filename,
        mode: 'per_stem',
        metrics: result.metrics,
        plan,
      });

    } else {
      // =======================================
      // Mode: Standard Mixing
      // =======================================
      const mixingConfig: MixingConfig = {
        inputBuffers: [], // Would be populated from track downloads
        duration: config?.outputDuration,
        outputFormat: 'mp3',
        enableMultibandCompression: useMultibandCompression,
        multibandConfig: config?.multibandConfig,
        enableSidechainDucking: useSidechainDucking,
        sidechainConfig: config?.sidechainConfig,
        enableDynamicEQ: useDynamicEQ,
        loudnessNormalization: loudnessNormalization,
        targetLoudness: config?.targetLoudness || -23,
        transitions: plan.transitions.map(t => ({
          fromIdx: trackOrder.indexOf(t.fromTrackId),
          toIdx: trackOrder.indexOf(t.toTrackId),
          duration: t.duration,
          style: t.style,
        })),
      };

      log('info', 'api.mashups.djmix.standardMode', {
        trackCount: trackOrder.length,
        transitionsCount: plan.transitions.length,
        processing: {
          multiband: useMultibandCompression,
          sidechain: useSidechainDucking,
          dynamicEQ: useDynamicEQ,
          loudness: loudnessNormalization,
        },
      });

      // Execute standard mixing
      const result = await mixToBuffer(mixingConfig.inputBuffers, mixingConfig);

      // Upload result
      const filename = `djmix-standard-${mashupId}-${Date.now()}.mp3`;
      const storageUrl = await uploadBufferToStorage(result.buffer, filename, 'audio/mpeg');

      // Update mashup
      await updateMashup(mashupId, {
        mixUrl: storageUrl,
        mixFilename: filename,
        mixingMode: 'standard',
        config: {
          ...mashup.config,
          usePerStemMixing: false,
          enableMultibandCompression: useMultibandCompression,
          enableSidechainDucking: useSidechainDucking,
          enableDynamicEQ: useDynamicEQ,
          loudnessNormalization: loudnessNormalization,
        },
        metrics: result.metrics,
        totalDuration: plan.totalDuration,
      });

      return NextResponse.json({
        success: true,
        url: storageUrl,
        filename,
        mode: 'standard',
        metrics: result.metrics,
        plan,
      });
    }

  } catch (error) {
    log('error', 'api.mashups.djmix.error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    logTelemetry({
      name: 'mashup.djmix.error',
      properties: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    return NextResponse.json(
      {
        error: 'Failed to render DJ mix',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/mashups/djmix/config
 * 
 * Get available configuration options.
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get('mode') || 'standard';

  return NextResponse.json({
    availableModes: ['standard', 'per_stem'],
    currentMode: mode,
    
    // Standard mode options
    standardMode: {
      transitionStyles: ['smooth', 'drop', 'cut', 'energy', 'filter_sweep', 'echo_reverb', 'backspin', 'tape_stop', 'stutter_edit'],
      fadeOutDurationRange: [0, 8], // seconds
      fadeInDurationRange: [0, 8],
      targetLoudnessRange: [-24, -14], // LUFS
    },
    
    // Per-stem mode options
    perStemMode: {
      requiresStems: true,
      availableStems: ['vocals', 'drums', 'bass', 'other'],
      transitionStyles: ['standard', 'vocals_only', 'instrumental_bridge', 'drum_swap', 'three_band_swap'],
    },
    
    // Processing options
    processing: {
      enableMultibandCompression: {
        description: 'Split audio into 3 bands and compress each separately for tighter control',
        impact: 'Improves mix clarity, reduces pumping',
      },
      enableSidechainDucking: {
        description: 'Dynamically reduce vocals when drums enter',
        impact: 'Creates cleaner vocal presence during transitions',
      },
      enableDynamicEQ: {
        description: 'Apply EQ only when frequencies compete',
        impact: 'Prevents frequency masking without affecting unaffected ranges',
      },
      loudnessNormalization: {
        options: ['none', 'ebu_r128', 'peak'],
        description: 'Ensure consistent loudness across mix',
        recommended: 'ebu_r128',
      },
    },
    
    recommendations: {
      forElectronic: {
        usePerStemMixing: true,
        enableMultibandCompression: true,
        enableSidechainDucking: true,
        enableDynamicEQ: true,
        loudnessNormalization: 'ebu_r128',
        targetLoudness: -14,
      },
      forHipHop: {
        usePerStemMixing: true,
        enableMultibandCompression: true,
        enableSidechainDucking: true,
        enableDynamicEQ: false,
        loudnessNormalization: 'ebu_r128',
        targetLoudness: -14,
      },
      forRock: {
        usePerStemMixing: false,
        enableMultibandCompression: true,
        enableSidechainDucking: false,
        enableDynamicEQ: true,
        loudnessNormalization: 'ebu_r128',
        targetLoudness: -16,
      },
    },
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map AutoDJ transition style to per-stem transition style
 */
function mapTransitionStyle(style: string): StemMixingConfig['transitions'][0]['style'] {
  const styleMap: Record<string, StemMixingConfig['transitions'][0]['style']> = {
    smooth: 'standard',
    drop: 'standard',
    cut: 'standard',
    energy: 'standard',
    filter_sweep: 'standard',
    echo_reverb: 'standard',
    backspin: 'standard',
    tape_stop: 'standard',
    stutter_edit: 'standard',
  };

  return styleMap[style] || 'standard';
}

/**
 * Get all stem buffers for a track
 * (This would import from stems-service)
 */
async function getAllStemBuffers(trackId: string): Promise<Map<string, any>> {
  // Placeholder - would import from stems-service
  return new Map();
}
