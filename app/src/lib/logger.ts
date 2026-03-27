import pino from 'pino';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const isDev = process.env.NODE_ENV === 'development';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  transport: isDev
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
  formatters: {
    level: (label) => ({ level: label }),
  },
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie'],
    censor: '[REDACTED]',
  },
});

const redactKeys = new Set(['authorization', 'cookie']);

function safeHeaders(headers: Headers | undefined) {
  if (!headers) return undefined;
  const entries: Record<string, string> = {};
  headers.forEach((value, key) => {
    if (redactKeys.has(key.toLowerCase())) return;
    entries[key] = value;
  });
  return entries;
}

export function log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  logger[level](meta ?? {}, message);
}

export function logRequest(
  level: LogLevel,
  message: string,
  request: Request,
  meta?: Record<string, unknown>
) {
  logger[level](
    {
      method: request.method,
      url: request.url,
      headers: safeHeaders(request.headers as Headers),
      ...meta,
    },
    message
  );
}

export function createRequestLogger(requestId: string) {
  return logger.child({ requestId });
}

export function createJobLogger(jobId: string, jobType: string) {
  return logger.child({ jobId, jobType });
}

export function createUserLogger(userId: string) {
  return logger.child({ userId });
}
