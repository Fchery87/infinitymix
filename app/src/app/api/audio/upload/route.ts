import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { uploadedTracks } from '@/lib/db/schema';
import {
  processSingleUpload,
  formatTrackResponse,
  parseBrowserAnalysisHintsInput,
} from '@/lib/audio/upload-service';
import { audioUploadSchema } from '@/lib/utils/validation';
import { ValidationError, AuthenticationError } from '@/lib/utils/error-handling';
import { uploadRateLimit, generalApiRateLimit, withRateLimit } from '@/lib/utils/rate-limiting';
import { eq } from 'drizzle-orm';

async function postHandler(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) throw new AuthenticationError('Authentication required');

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const projectId = formData.get('projectId');
    const browserHints = parseBrowserAnalysisHintsInput(
      formData.get('browserAnalysisHints')
    );
    
    const { files: validatedFiles } = audioUploadSchema.parse({ files });
    
    const createdTracks = [];
    for (const [index, file] of validatedFiles.entries()) {
      const matchingHint =
        browserHints[index] &&
        browserHints[index].fileName === file.name &&
        browserHints[index].fileSizeBytes === file.size
          ? browserHints[index]
          : undefined;
      const track = await processSingleUpload(
        user.id,
        file,
        typeof projectId === 'string' ? projectId : null,
        matchingHint
      );
      createdTracks.push(track);
    }

    return NextResponse.json({
      tracks: createdTracks,
      message: `Successfully uploaded ${createdTracks.length} files`,
    });
    
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message, code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }
    
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { error: error.message, code: 'AUTHENTICATION_ERROR' },
        { status: 401 }
      );
    }

    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export const POST = withRateLimit(uploadRateLimit)(postHandler);

async function getHandler(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) throw new AuthenticationError('Authentication required');

    const tracks = await db
      .select()
      .from(uploadedTracks)
      .where(eq(uploadedTracks.userId, user.id))
      .orderBy(uploadedTracks.createdAt);

    return NextResponse.json({
      tracks: tracks.map((track) => formatTrackResponse(track)),
    });
    
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { error: error.message, code: 'AUTHENTICATION_ERROR' },
        { status: 401 }
      );
    }

    console.error('Get tracks error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export const GET = withRateLimit(generalApiRateLimit)(getHandler);
