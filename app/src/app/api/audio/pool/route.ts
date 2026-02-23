import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { uploadedTracks } from '@/lib/db/schema';
import { validateAudioFile } from '@/lib/utils/helpers';
import {
  processSingleUpload,
  formatTrackResponse,
  parseBrowserAnalysisHintsInput,
} from '@/lib/audio/upload-service';
import { audioUploadSchema } from '@/lib/utils/validation';
import {
  AuthenticationError,
  ValidationError,
} from '@/lib/utils/error-handling';
import {
  withRateLimit,
  uploadRateLimit,
  generalApiRateLimit,
} from '@/lib/utils/rate-limiting';
import { and, eq, desc, sql } from 'drizzle-orm';

const withUploadRateLimit = withRateLimit(uploadRateLimit);
const withGeneralRateLimit = withRateLimit(generalApiRateLimit);

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

async function handlePost(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) throw new AuthenticationError();

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const projectId = formData.get('projectId') as string | null;
    const browserHints = parseBrowserAnalysisHintsInput(
      formData.get('browserAnalysisHints')
    );

    audioUploadSchema.parse({ files });

    if (!files || files.length === 0) {
      throw new ValidationError('No files provided');
    }

    if (files.length > 5) {
      throw new ValidationError('Maximum 5 files allowed');
    }

    const uploadedFiles = [];
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const maxTotalSize = 100 * 1024 * 1024;

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

    for (const [index, file] of files.entries()) {
      const matchingHint =
        browserHints[index] &&
        browserHints[index].fileName === file.name &&
        browserHints[index].fileSizeBytes === file.size
          ? browserHints[index]
          : undefined;
      const track = await processSingleUpload(user.id, file, projectId, matchingHint);
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

async function handleGet(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const analysisQualityFilter = searchParams.get('analysisQuality')?.trim() || null;
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(searchParams.get('limit') || String(DEFAULT_PAGE_SIZE), 10))
    );
    const offset = (page - 1) * limit;
    const whereClause = analysisQualityFilter
      ? and(
          eq(uploadedTracks.userId, user.id),
          eq(uploadedTracks.analysisQuality, analysisQualityFilter)
        )
      : eq(uploadedTracks.userId, user.id);

    const [tracks, countResult, qualityCountsRaw] = await Promise.all([
      db
        .select()
        .from(uploadedTracks)
        .where(whereClause)
        .orderBy(desc(uploadedTracks.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(uploadedTracks)
        .where(whereClause),
      db
        .select({
          analysisQuality: uploadedTracks.analysisQuality,
          count: sql<number>`count(*)`,
        })
        .from(uploadedTracks)
        .where(eq(uploadedTracks.userId, user.id))
        .groupBy(uploadedTracks.analysisQuality),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    const formattedTracks = tracks.map(formatTrackResponse);
    const qualityCounts = Object.fromEntries(
      qualityCountsRaw.map((row) => [row.analysisQuality ?? 'unknown', Number(row.count ?? 0)])
    );

    return NextResponse.json({
      tracks: formattedTracks,
      filters: {
        analysisQuality: analysisQualityFilter,
      },
      debug: {
        qualityCounts,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + tracks.length < total,
      },
    });
  } catch (error) {
    console.error('Get tracks error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve tracks' },
      { status: 500 }
    );
  }
}

export const POST = withUploadRateLimit(handlePost);
export const GET = withGeneralRateLimit(handleGet);
