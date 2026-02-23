import { config } from './config'
import { logger } from './logger'

type TelemetryStatus = 'start' | 'success' | 'error'
type TelemetryArea = 'render' | 'service'

type TelemetryPayload = {
  area: TelemetryArea
  event: string
  status: TelemetryStatus
  durationMs?: number
  [key: string]: unknown
}

export function emitTelemetry(payload: TelemetryPayload): void {
  if (!config.observability.enableDetailedMetrics && payload.status !== 'error') return
  const { area, event, status, durationMs, ...meta } = payload
  logger.info('telemetry', {
    area,
    event,
    status,
    duration_ms: durationMs,
    ...meta
  })
}

export async function withTelemetry<T>(
  area: TelemetryArea,
  event: string,
  fn: () => Promise<T>,
  meta?: Record<string, unknown>
): Promise<T> {
  const startedAt = Date.now()
  emitTelemetry({ area, event, status: 'start', ...meta })
  try {
    const result = await fn()
    emitTelemetry({ area, event, status: 'success', durationMs: Date.now() - startedAt, ...meta })
    return result
  } catch (error) {
    emitTelemetry({
      area,
      event,
      status: 'error',
      durationMs: Date.now() - startedAt,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      ...meta
    })
    throw error
  }
}

