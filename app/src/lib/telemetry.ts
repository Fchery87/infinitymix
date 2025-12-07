import { reportError, reportPerformance } from '@/lib/monitoring';

type TelemetryLevel = 'info' | 'warn' | 'error';

type TelemetryEvent = {
  name: string;
  level?: TelemetryLevel;
  properties?: Record<string, unknown>;
};

export const logTelemetry = ({ name, level = 'info', properties }: TelemetryEvent) => {
  const message = `[telemetry] ${name}`;
  if (level === 'error') {
    console.error(message, properties ?? {});
  } else if (level === 'warn') {
    console.warn(message, properties ?? {});
  } else {
    console.info(message, properties ?? {});
  }
};

export const withTelemetry = async <T>(
  name: string,
  action: () => Promise<T>,
  properties?: Record<string, unknown>
): Promise<T> => {
  const start = Date.now();
  logTelemetry({ name, level: 'info', properties: { phase: 'start', ...properties } });

  try {
    const result = await action();
    reportPerformance(name, start, { status: 'success', ...properties });
    logTelemetry({ name, level: 'info', properties: { phase: 'success', duration_ms: Date.now() - start, ...properties } });
    return result;
  } catch (error) {
    reportPerformance(name, start, { status: 'error', ...properties });
    logTelemetry({ name, level: 'error', properties: { phase: 'error', duration_ms: Date.now() - start, ...properties } });
    reportError(error as Error, { name, ...properties });
    throw error;
  }
};
