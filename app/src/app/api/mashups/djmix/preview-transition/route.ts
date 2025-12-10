import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUser } from '@/lib/auth/session';
import { renderTransitionPreview } from '@/lib/audio/auto-dj-service';

const mixPointSchema = z.object({
  outStart: z.number().nonnegative(),
  inStart: z.number().nonnegative(),
  overlapSeconds: z.number().positive(),
  phraseAligned: z.boolean().optional(),
});

const bodySchema = z.object({
  trackAId: z.string().uuid(),
  trackBId: z.string().uuid(),
  mixPoint: mixPointSchema,
  transitionStyle: z.enum(['smooth', 'drop', 'energy', 'cut']).optional(),
  targetBpm: z.number().min(60).max(200).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = bodySchema.parse(await req.json());

    const result = await renderTransitionPreview({
      trackAId: parsed.trackAId,
      trackBId: parsed.trackBId,
      mixPoint: {
        ...parsed.mixPoint,
        phraseAligned: parsed.mixPoint.phraseAligned ?? false,
      },
      transitionStyle: parsed.transitionStyle,
      targetBpm: parsed.targetBpm,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to render preview', message: (error as Error).message }, { status: 500 });
  }
}
