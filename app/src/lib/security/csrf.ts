import { randomBytes, createHmac } from 'crypto';

const CSRF_SECRET = process.env.CSRF_SECRET || 'dev-csrf-secret-change-in-production';

export function generateCSRFToken(sessionId: string): string {
  const token = randomBytes(32).toString('hex');
  const signature = createHmac('sha256', CSRF_SECRET)
    .update(`${sessionId}:${token}`)
    .digest('hex');
  return `${token}.${signature}`;
}

export function validateCSRFToken(token: string, sessionId: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [tokenId, signature] = parts;
  const expected = createHmac('sha256', CSRF_SECRET)
    .update(`${sessionId}:${tokenId}`)
    .digest('hex');

  return signature === expected;
}

export function csrfErrorResponse() {
  return Response.json(
    { error: 'CSRF token validation failed' },
    { status: 403 }
  );
}

export function extractCSRFToken(request: Request): string | null {
  return (
    request.headers.get('X-CSRF-Token') ||
    request.headers.get('x-csrf-token')
  );
}
