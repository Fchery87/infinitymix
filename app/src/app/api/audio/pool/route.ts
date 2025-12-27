import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { uploadedTracks } from '@/lib/db/schema';
import { validateAudioFile } from '@/lib/utils/helpers';
import {
  processSingleUpload,
  formatTrackResponse,
} from '@/lib/audio/upload-service';
import { audioUploadSchema } from '@/lib/utils/validation';
import {
  AuthenticationError,
  ValidationError,
} from '@/lib/utils/error-handling';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) throw new AuthenticationError();

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const projectId = formData.get('projectId') as string | null;

    audioUploadSchema.parse({ files });

    if (!files || files.length === 0) {
      throw new ValidationError('No files provided');
    }

    if (files.length > 5) {
      throw new ValidationError('Maximum 5 files allowed');
    }

    const uploadedFiles = [];
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const maxTotalSize = 100 * 1024 * 1024; // 100MB total

    if (totalSize > maxTotalSize) {
      throw new ValidationError('Total file size exceeds 100MB limit');
    }

    for (const file of files) {
      if (!validateAudioFile(file)) {
        throw new ValidationError(
          `Invalid file type or size: ${file.name}. Only MP3/WAV files up to 50MB are allowed.`
        );
      }
    }

    for (const file of files) {
      const track = await processSingleUpload(user.id, file, projectId);
      uploadedFiles.push(track);
    }

    return NextResponse.json(uploadedFiles);
  } catch (error) {
    console.error('Upload error:', error);
    if (
      error instanceof ValidationError ||
      error instanceof AuthenticationError
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { error: 'Failed to upload files' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tracks = await db
      .select()
      .from(uploadedTracks)
      .where(eq(uploadedTracks.userId, user.id))
      .orderBy(uploadedTracks.createdAt);

    const formattedTracks = tracks.map(formatTrackResponse);

    return NextResponse.json(formattedTracks);
  } catch (error) {
    console.error('Get tracks error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve tracks' },
      { status: 500 }
    );
  }
}
