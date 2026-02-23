import { logTelemetry, withTelemetry } from '@/lib/telemetry';

type AudioPipelineArea = 'analysis' | 'planner' | 'render' | 'upload' | 'inference' | 'preview';
type AudioPipelineStatus = 'start' | 'success' | 'error';

type AudioTelemetryProperties = Record<string, unknown> & {
  area?: AudioPipelineArea;
  stage?: string;
  status?: AudioPipelineStatus;
};

export function emitAudioPipelineTelemetry(name: string, properties?: AudioTelemetryProperties) {
  logTelemetry({
    name: `audio_pipeline.${name}`,
    level: properties?.status === 'error' ? 'error' : 'info',
    properties,
  });
}

export async function withAudioPipelineTelemetry<T>(
  name: string,
  action: () => Promise<T>,
  properties?: AudioTelemetryProperties
): Promise<T> {
  return withTelemetry(`audio_pipeline.${name}`, action, properties);
}

export function recordAudioPipelineDuration(
  area: AudioPipelineArea,
  stage: string,
  durationMs: number,
  meta?: Record<string, unknown>
) {
  emitAudioPipelineTelemetry('duration', {
    area,
    stage,
    status: 'success',
    duration_ms: durationMs,
    ...meta,
  });
}
