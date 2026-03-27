import { trace, metrics, context } from '@opentelemetry/api';

const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'infinitymix';

export const tracer = trace.getTracer(SERVICE_NAME);
export const meter = metrics.getMeter(SERVICE_NAME);

export function createSpan(name: string, fn: () => Promise<unknown>) {
  return tracer.startActiveSpan(name, async (span) => {
    try {
      const result = await fn();
      span.setStatus({ code: 1 });
      return result;
    } catch (error) {
      span.setStatus({
        code: 2,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      span.end();
    }
  });
}

export const audioProcessingDuration = meter.createHistogram(
  'audio.processing.duration',
  { unit: 'ms', description: 'Duration of audio processing operations' }
);

export const queueJobCounter = meter.createCounter(
  'queue.jobs.total',
  { description: 'Total queue jobs processed' }
);

export const mashupGenerationCounter = meter.createCounter(
  'mashup.generation.total',
  { description: 'Total mashup generations' }
);
