/**
 * API Route: Per-Stem Mixing
 * 
 * Advanced mashup blending using per-stem processing.
 * Each track's stems (vocals, drums, bass, other) are processed individually.
 */

import { NextRequest, NextResponse } from 'next/server';
import { log } from '@/lib/logger';
import { logTelemetry } from '@/lib/telemetry';
import { uploadBufferToStorage } from '@/lib/storage';
import { mixStemsPerTrack, validateStemMixingConfig, type StemMixingConfig } from '@/lib/audio/stem-mixing-service';
import { getAllStemBuffers, type StemRecord } from '@/lib/audio/stems-service';
import { getTrack, updateTrack } from '@/lib/db';

/**
 * POST /api/mashups/stem-per-track
 * 
 * Create a mashup using per-stem mixing architecture.
 */
export async function POST(req: NextRequest) {
  const startedAt = Date.now();

  try {
    // ========================================================================
    // 1. Parse request body
    // ========================================================================
    const body = await req.json();
    const {
      trackIds,
      transitions,
      processing = {},
      outputDuration,
    } = body;

    log('info', 'api.mashups.stemPerTrack.start', {
      trackIds,
      transitionsCount: transitions?.length,
      processing,
    });

    // ========================================================================
    // 2. Validate input
    // ========================================================================
    if (!trackIds || !Array.isArray(trackIds) || trackIds.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 tracks are required' },
        { status: 400 }
      );
    }

    if (!transitions || !Array.isArray(transitions) || transitions.length === 0) {
      return NextResponse.json(
        { error: 'At least 1 transition is required' },
        { status: 400 }
      );
    }

    // ========================================================================
    // 3. Fetch all stems for all tracks
    // ========================================================================
    const stemRecordsByTrack: Map<string, Map<string, StemRecord>> = new Map();

    for (const trackId of trackIds) {
      const track = await getTrack(trackId);
      
      if (!track) {
        return NextResponse.json(
          { error: `Track not found: ${trackId}` },
          { status: 404 }
        );
      }

      const stems = await getAllStemBuffers(track.id);
      stemRecordsByTrack.set(track.id, stems);

      log('info', 'api.mashups.stemPerTrack.stemsLoaded', {
        trackId,
        stemCount: stems.size,
      });
    }

    // ========================================================================
    // 4. Build stem mixing configuration
    // ========================================================================
    const config: StemMixingConfig = {
      tracks: [],
      transitions: transitions.map((t: any) => ({
        fromTrackId: t.fromTrackId,
        toTrackId: t.toTrackId,
        style: t.style || 'standard',
        duration: t.duration || 4,
        transitionPoint: t.transitionPoint,
        crossfadeCurve: t.crossfadeCurve || 'smooth',
        enableFilterSweep: t.enableFilterSweep || false,
      })),
      processing: {
        enableMultibandCompression: processing.enableMultibandCompression ?? true,
        enableSidechainDucking: processing.enableSidechainDucking ?? true,
        enableDynamicEQ: processing.enableDynamicEQ ?? true,
        loudnessNormalization: processing.loudnessNormalization || 'ebu_r128',
        targetLoudness: processing.targetLoudness || -23,
      },
    };

    // Populate stems for each track
    for (const trackId of trackIds) {
      const stems = stemRecordsByTrack.get(trackId);
      if (!stems) continue;

      const track = await getTrack(trackId);
      if (!track) continue;

      config.tracks.push({
        id: track.id,
        bpm: track.bpm,
        stems: {
          vocals: stems.get('vocals') ? {
            buffer: stems.get('vocals')!.buffer,
            volume: 0.75,
            eq: undefined,
            enabled: true,
          } : undefined,
          drums: stems.get('drums') ? {
            buffer: stems.get('drums')!.buffer,
            volume: 0.85,
            eq: undefined,
            enabled: true,
          } : undefined,
          bass: stems.get('bass') ? {
            buffer: stems.get('bass')!.buffer,
            volume: 0.90,
            eq: undefined,
            enabled: true,
          } : undefined,
          other: stems.get('other') ? {
            buffer: stems.get('other')!.buffer,
            volume: 0.70,
            eq: undefined,
            enabled: true,
          } : undefined,
        },
      });
    }

    // ========================================================================
    // 5. Validate configuration
    // ========================================================================
    const validation = validateStemMixingConfig(config);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid configuration', details: validation.errors },
        { status: 400 }
      );
    }

    log('info', 'api.mashups.stemPerTrack.configValidated', {
      trackCount: config.tracks.length,
      transitionsCount: config.transitions.length,
    });

    // ========================================================================
    // 6. Execute per-stem mixing
    // ========================================================================
    const result = await mixStemsPerTrack(config, outputDuration);

    log('info', 'api.mashups.stemPerTrack.mixingCompleted', {
      processingTimeMs: result.metrics.processingTimeMs,
      outputSizeBytes: result.metrics.outputSizeBytes,
      stemsProcessed: result.metrics.stemsProcessed,
      transitionsApplied: result.metrics.transitionsApplied,
    });

    // ========================================================================
    // 7. Upload result to storage
    // ========================================================================
    const timestamp = Date.now();
    const filename = `mashup-stem-per-track-${timestamp}.mp3`;
    const storageUrl = await uploadBufferToStorage(result.buffer, filename, 'audio/mpeg');

    log('info', 'api.mashups.stemPerTrack.uploaded', {
      filename,
      storageUrl,
    });

    // ========================================================================
    // 8. Create/update mashup record in database
    // ========================================================================
    // This would be handled by the mashup creation/update logic
    // For now, we just return the URL

    // ========================================================================
    // 9. Log telemetry and metrics
    // ========================================================================
    logTelemetry({
      name: 'mashup.stemPerTrack.completed',
      properties: {
        trackCount: trackIds.length,
        processingTimeMs: result.metrics.processingTimeMs,
        outputSizeBytes: result.metrics.outputSizeBytes,
        stemsProcessed: result.metrics.stemsProcessed,
        transitionsApplied: result.metrics.transitionsApplied,
        enableMultiband: config.processing.enableMultibandCompression,
        enableSidechain: config.processing.enableSidechainDucking,
        enableDynamicEQ: config.processing.enableDynamicEQ,
        loudnessNorm: config.processing.loudnessNormalization,
      },
      measurements: {
        processing_time_ms: result.metrics.processingTimeMs,
        stems_processed: result.metrics.stemsProcessed,
      },
    });

    // ========================================================================
    // 10. Return success response
    // ========================================================================
    const totalTime = Date.now() - startedAt;

    return NextResponse.json({
      success: true,
      url: storageUrl,
      filename,
      config,
      metrics: result.metrics,
      totalProcessingTimeMs: totalTime,
    });

  } catch (error) {
    log('error', 'api.mashups.stemPerTrack.error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    logTelemetry({
      name: 'mashup.stemPerTrack.error',
      properties: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    return NextResponse.json(
      {
        error: 'Failed to create per-stem mashup',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/mashups/stem-per-track/config
 * 
 * Get default configuration for per-stem mixing.
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const trackCount = parseInt(searchParams.get('trackCount') || '2', 10);

  // Generate example configuration
  const exampleConfig = {
    trackIds: Array.from({ length: trackCount }, (_, i) => `track-${i + 1}`),
    transitions: [
      {
        fromTrackId: `track-${1}`,
        toTrackId: `track-${2}`,
        style: 'standard',
        duration: 4,
        crossfadeCurve: 'smooth',
      },
    ],
    processing: {
      enableMultibandCompression: true,
      enableSidechainDucking: true,
      enableDynamicEQ: true,
      loudnessNormalization: 'ebu_r128',
      targetLoudness: -23,
    },
    outputDuration: 60 * 5, // 5 minutes
  };

  return NextResponse.json({
    exampleConfig,
    availableTransitionStyles: [
      'standard',
      'vocals_only',
      'instrumental_bridge',
      'drum_swap',
      'three_band_swap',
    ],
    availableCrossfadeCurves: [
      'tri',
      'exp',
      'log',
      'qsin',
      'hsin',
      'par',
      'cub',
    ],
    description: 'Per-stem mixing processes each stem (vocals, drums, bass, other) individually for cleaner blends.',
    benefits: [
      'Prevents frequency masking',
      'Enables instrumental bridge transitions',
      'Allows drum swaps between tracks',
      'Cleaner vocal separation',
      'Better bass control',
    ],
  });
}
