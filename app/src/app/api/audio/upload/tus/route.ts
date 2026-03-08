import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { uploadRateLimit, withRateLimit } from '@/lib/utils/rate-limiting';
import { createTusSession, parseTusMetadata } from '@/lib/audio/tus-upload';

function tusHeaders(extra?: Record<string, string>) {
  return {
    'Tus-Resumable': '1.0.0',
    'Cache-Control': 'no-store',
    ...extra,
  };
}

async function optionsHandler() {
  return new NextResponse(null, {
    status: 204,
    headers: tusHeaders({
      'Tus-Version': '1.0.0',
      'Tus-Extension': 'creation',
      'Tus-Max-Size': `${50 * 1024 * 1024}`,
    }),
  });
}

async function postHandler(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const uploadLength = Number(request.headers.get('Upload-Length') || '0');
  if (!Number.isFinite(uploadLength) || uploadLength <= 0) {
    return NextResponse.json({ error: 'Upload-Length header is required' }, { status: 400 });
  }
  if (uploadLength > 50 * 1024 * 1024) {
    return NextResponse.json({ error: 'Upload exceeds 50MB limit' }, { status: 413 });
  }

  const metadata = parseTusMetadata(request.headers.get('Upload-Metadata'));
  const uploadId = randomUUID();
  await createTusSession({
    id: uploadId,
    userId: user.id,
    uploadLength,
    metadata,
  });

  return new NextResponse(null, {
    status: 201,
    headers: tusHeaders({
      Location: `/api/audio/upload/tus/${uploadId}`,
      'Upload-Offset': '0',
    }),
  });
}

export const OPTIONS = optionsHandler;
export const POST = withRateLimit(uploadRateLimit)(postHandler);
