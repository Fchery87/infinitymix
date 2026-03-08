import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { uploadedTracks } from '@/lib/db/schema';
import { mixToBuffer } from '@/lib/audio/mixing-service';
import { getStorage } from '@/lib/storage';
import { eq, and, inArray } from 'drizzle-orm';
import {
  buildPreviewGenerationIdempotencyKey,
  getAutomationRecoveryPolicy,
} from '@/lib/runtime/recovery';

const MAX_DURATION = 30;

/**
 * Track data for mixing
 */
interface TrackForMixing {
  id: string;
  storageUrl: string;
  mimeType: string;
  bpm: number | null;
  buffer: Buffer;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!request.headers.get('content-type')?.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 415 });
    }

    const { trackIds, durationSeconds, mixMode = 'standard' } = await request.json();
    if (!Array.isArray(trackIds) || trackIds.length < 2) {
      return NextResponse.json({ error: 'At least 2 trackIds required' }, { status: 400 });
    }

    const safeDuration = Math.min(MAX_DURATION, Math.max(10, Number(durationSeconds) || 20));
    const previewIdempotencyKey = buildPreviewGenerationIdempotencyKey({
      userId: user.id,
      trackIds,
      durationSeconds: safeDuration,
      mixMode,
    });
    const recoveryPolicy = getAutomationRecoveryPolicy('preview');

    const records = await db
      .select({ id: uploadedTracks.id, storageUrl: uploadedTracks.storageUrl, mimeType: uploadedTracks.mimeType, userId: uploadedTracks.userId, bpm: uploadedTracks.bpm })
      .from(uploadedTracks)
      .where(and(eq(uploadedTracks.userId, user.id), inArray(uploadedTracks.id, trackIds)));

    if (records.length !== trackIds.length) {
      return NextResponse.json({ error: 'One or more tracks not found' }, { status: 404 });
    }

    const storage = await getStorage();
    if (!storage.getFile) return NextResponse.json({ error: 'Storage driver cannot read files' }, { status: 500 });

    const tracks: TrackForMixing[] = [];
    const buffers: Buffer[] = [];
    for (const r of records) {
      const fetched = await storage.getFile(r.storageUrl);
      if (!fetched?.buffer) return NextResponse.json({ error: 'Failed to fetch track audio' }, { status: 500 });
      buffers.push(fetched.buffer);
      tracks.push({ id: r.id, storageUrl: r.storageUrl, mimeType: fetched.mimeType || r.mimeType, bpm: r.bpm ? Number(r.bpm) : null, buffer: fetched.buffer });
    }

    const result = await mixToBuffer(buffers, { duration: safeDuration });
    return new NextResponse(result.buffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
        'X-Preview-Idempotency-Key': previewIdempotencyKey,
        'X-Automation-Recovery-Policy': recoveryPolicy.execution,
      },
    });
  } catch (error) {
    console.error('Preview error:', error);
    return NextResponse.json({ error: 'Failed to render preview' }, { status: 500 });
  }
}
