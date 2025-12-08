import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { getSessionUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { uploadedTracks } from '@/lib/db/schema';
import { completeUploadSchema } from '@/lib/utils/validation';
import { ValidationError, AuthenticationError } from '@/lib/utils/error-handling';
import { getStorage } from '@/lib/storage';
import { startTrackAnalysis } from '@/lib/audio/analysis-service';
import { formatTrackResponse } from '@/lib/audio/upload-service';
import { uploadRateLimit, withRateLimit } from '@/lib/utils/rate-limiting';

const ALLOWED_TYPES = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/wave'];
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export async function completeHandler(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) throw new AuthenticationError('Authentication required');

    if (request.headers.get('content-type')?.includes('application/json') !== true) {
      return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 415 });
    }

    const body = await request.json();
    const { key, filename, contentType, size } = completeUploadSchema.parse(body);

    if (!ALLOWED_TYPES.includes(contentType)) {
      throw new ValidationError(`Unsupported file type: ${contentType}`);
    }
    if (size > MAX_FILE_SIZE_BYTES) {
      throw new ValidationError(`File ${filename} exceeds 50MB limit`);
    }

    const storage = await getStorage();
    const locator = `r2://${key}`;

    const fileObject = storage.getFile ? await storage.getFile(locator) : null;
    if (!fileObject) {
      return NextResponse.json({ error: 'Uploaded file not found in storage' }, { status: 404 });
    }

    const [track] = await db
      .insert(uploadedTracks)
      .values({
        id: nanoid(),
        userId: user.id,
        originalFilename: filename,
        storageUrl: locator,
        fileSizeBytes: size,
        mimeType: contentType,
        uploadStatus: 'uploaded',
        analysisStatus: 'pending',
      })
      .returning();

    // Fire and forget analysis using downloaded buffer
    void startTrackAnalysis({
      trackId: track.id,
      buffer: fileObject.buffer,
      storageUrl: locator,
      mimeType: contentType,
      fileName: filename,
    });

    return NextResponse.json({ track: formatTrackResponse(track) });
  } catch (error) {
    if (error instanceof ValidationError || error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Complete upload error:', error);
    return NextResponse.json({ error: 'Failed to register upload' }, { status: 500 });
  }
}

export const POST = withRateLimit(uploadRateLimit)(completeHandler);
