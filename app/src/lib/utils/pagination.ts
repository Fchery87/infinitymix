export function encodeCursor(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function decodeCursor<T = unknown>(cursor: string): T {
  return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8')) as T;
}
