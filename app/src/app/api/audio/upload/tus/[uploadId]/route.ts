import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { finalizeUploadedBuffer } from '@/lib/audio/upload-service';
import {
  appendTusChunk,
  cleanupTusSession,
  readTusSession,
  readTusUploadBuffer,
  writeTusSession,
} from '@/lib/audio/tus-upload';
import { ValidationError } from '@/lib/utils/error-handling';
import { uploadRateLimit, withRateLimit } from '@/lib/utils/rate-limiting';

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

async function headHandler(
  request: NextRequest,
  { params }: { params: Promise<{ uploadId: string }> }
) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { uploadId } = await params;
  const session = await readTusSession(uploadId);
  if (!session || session.userId !== user.id) {
    return NextResponse.json({ error: 'Upload not found' }, { status: 404 });
  }

  return new NextResponse(null, {
    status: 200,
    headers: tusHeaders({
      'Upload-Offset': `${session.bytesReceived}`,
      'Upload-Length': `${session.uploadLength}`,
    }),
  });
}

async function patchHandler(
  request: NextRequest,
  { params }: { params: Promise<{ uploadId: string }> }
) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { uploadId } = await params;
    const session = await readTusSession(uploadId);
    if (!session || session.userId !== user.id) {
      return NextResponse.json({ error: 'Upload not found' }, { status: 404 });
    }

    const uploadOffset = Number(request.headers.get('Upload-Offset') || '-1');
    if (uploadOffset !== session.bytesReceived) {
      return new NextResponse(null, {
        status: 409,
        headers: tusHeaders({
          'Upload-Offset': `${session.bytesReceived}`,
        }),
      });
    }

    if (session.completedAt) {
      return new NextResponse(null, {
        status: 204,
        headers: tusHeaders({
          'Upload-Offset': `${session.bytesReceived}`,
        }),
      });
    }

    const chunk = Buffer.from(await request.arrayBuffer());
    if (chunk.length === 0) {
      return new NextResponse(null, {
        status: 204,
        headers: tusHeaders({
          'Upload-Offset': `${session.bytesReceived}`,
        }),
      });
    }

    await appendTusChunk(session, chunk);

    if (session.bytesReceived > session.uploadLength) {
      await cleanupTusSession(uploadId);
      throw new ValidationError('Upload exceeded declared Upload-Length');
    }

    if (session.bytesReceived === session.uploadLength) {
      const buffer = await readTusUploadBuffer(session);
      const track = await finalizeUploadedBuffer({
        userId: user.id,
        filename: session.metadata.filename,
        contentType: session.metadata.contentType,
        size: session.uploadLength,
        buffer,
        projectId: session.metadata.projectId ?? null,
      });

      session.completedAt = new Date().toISOString();
      session.trackId = track.id;
      await writeTusSession(session);
      await cleanupTusSession(uploadId);
    }

    return new NextResponse(null, {
      status: 204,
      headers: tusHeaders({
        'Upload-Offset': `${session.bytesReceived}`,
      }),
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Tus patch upload error:', error);
    return NextResponse.json({ error: 'Failed to append upload chunk' }, { status: 500 });
  }
}

export const OPTIONS = optionsHandler;
export const HEAD = withRateLimit(uploadRateLimit)(headHandler);
export const PATCH = withRateLimit(uploadRateLimit)(patchHandler);
