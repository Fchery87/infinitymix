import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { uploadedTracks, mashups, projects } from '@/lib/db/schema';
import { getSessionUser } from '@/lib/auth/session';
import { eq, ilike, desc, and } from 'drizzle-orm';
import { z } from 'zod';
import { withRateLimit, generalApiRateLimit } from '@/lib/utils/rate-limiting';
import { log } from '@/lib/logger';

const withGeneralRateLimit = withRateLimit(generalApiRateLimit);

const querySchema = z.object({
  q: z.string().min(1).max(100),
  type: z.enum(['all', 'tracks', 'mashups', 'projects']).default('all'),
});

const MAX_RESULTS_PER_TYPE = 5;

async function handleGet(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const queryParams = querySchema.safeParse({
      q: searchParams.get('q'),
      type: searchParams.get('type') ?? 'all',
    });

    if (!queryParams.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryParams.error.issues },
        { status: 400 }
      );
    }

    const { q, type } = queryParams.data;
    const searchTerm = `%${q}%`;

    const results: {
      tracks: Array<{
        id: string;
        name: string;
        type: 'track';
        bpm: string | null;
        key: string | null;
        duration: string | null;
        createdAt: string;
      }>;
      mashups: Array<{
        id: string;
        name: string;
        type: 'mashup';
        status: string;
        createdAt: string;
      }>;
      projects: Array<{
        id: string;
        name: string;
        type: 'project';
        status: string;
        createdAt: string;
      }>;
    } = { tracks: [], mashups: [], projects: [] };

    const shouldSearch = (t: string) => type === 'all' || type === t;

    if (shouldSearch('tracks')) {
      const tracks = await db
        .select({
          id: uploadedTracks.id,
          name: uploadedTracks.originalFilename,
          bpm: uploadedTracks.bpm,
          key: uploadedTracks.keySignature,
          duration: uploadedTracks.durationSeconds,
          createdAt: uploadedTracks.createdAt,
        })
        .from(uploadedTracks)
        .where(
          and(
            eq(uploadedTracks.userId, user.id),
            ilike(uploadedTracks.originalFilename, searchTerm)
          )
        )
        .orderBy(desc(uploadedTracks.createdAt))
        .limit(MAX_RESULTS_PER_TYPE);

      results.tracks = tracks.map((t) => ({
        id: t.id,
        name: t.name,
        type: 'track' as const,
        bpm: t.bpm,
        key: t.key,
        duration: t.duration,
        createdAt: t.createdAt?.toISOString() ?? new Date().toISOString(),
      }));
    }

    if (shouldSearch('mashups')) {
      const mashupResults = await db
        .select({
          id: mashups.id,
          name: mashups.name,
          status: mashups.generationStatus,
          createdAt: mashups.createdAt,
        })
        .from(mashups)
        .where(
          and(
            eq(mashups.userId, user.id),
            ilike(mashups.name, searchTerm)
          )
        )
        .orderBy(desc(mashups.createdAt))
        .limit(MAX_RESULTS_PER_TYPE);

      results.mashups = mashupResults.map((m) => ({
        id: m.id,
        name: m.name,
        type: 'mashup' as const,
        status: m.status,
        createdAt: m.createdAt?.toISOString() ?? new Date().toISOString(),
      }));
    }

    if (shouldSearch('projects')) {
      const projectResults = await db
        .select({
          id: projects.id,
          name: projects.name,
          status: projects.status,
          createdAt: projects.createdAt,
        })
        .from(projects)
        .where(
          and(
            eq(projects.userId, user.id),
            ilike(projects.name, searchTerm)
          )
        )
        .orderBy(desc(projects.createdAt))
        .limit(MAX_RESULTS_PER_TYPE);

      results.projects = projectResults.map((p) => ({
        id: p.id,
        name: p.name,
        type: 'project' as const,
        status: p.status,
        createdAt: p.createdAt?.toISOString() ?? new Date().toISOString(),
      }));
    }

    return NextResponse.json(results, {
      headers: { 'Cache-Control': 'private, max-age=10' },
    });
  } catch (error) {
    console.error('Search error:', error);
    log('error', 'search.failed', { error: (error as Error)?.message });
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}

export const GET = withGeneralRateLimit(handleGet);
