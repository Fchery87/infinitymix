export type LogLevel = 'info' | 'warn' | 'error';

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
  const payload = { level, message, ...meta };
  const serialized = JSON.stringify(payload);
  if (level === 'error') console.error(serialized);
  else if (level === 'warn') console.warn(serialized);
  else console.info(serialized);
}

export function logRequest(level: LogLevel, message: string, request: Request, meta?: Record<string, unknown>) {
  log(level, message, {
    method: request.method,
    url: request.url,
    headers: safeHeaders(request.headers as Headers),
    ...meta,
  });
}
