import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { mashups, mashupInputTracks, uploadedTracks } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mashupId: string }> }
) {
  try {
    const { mashupId } = await params;
    const user = await getSessionUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [mashup] = await db
      .select({ id: mashups.id, userId: mashups.userId })
      .from(mashups)
      .where(and(eq(mashups.id, mashupId), eq(mashups.userId, user.id)));

    if (!mashup) return NextResponse.json({ error: 'Mashup not found' }, { status: 404 });

    const inputTracks = await db
      .select({ waveformLite: uploadedTracks.waveformLite })
      .from(mashupInputTracks)
      .innerJoin(uploadedTracks, eq(mashupInputTracks.uploadedTrackId, uploadedTracks.id))
      .where(eq(mashupInputTracks.mashupId, mashupId));

    const combined: number[] = [];
    for (const track of inputTracks) {
      if (track.waveformLite && track.waveformLite.length > 0) {
        combined.push(...track.waveformLite);
      }
    }

    if (combined.length === 0) {
      const bars = 80;
      const synthetic = Array.from({ length: bars }, (_, i) => {
        const base = 0.3 + Math.sin(i * 0.3) * 0.2 + Math.sin(i * 0.7) * 0.15;
        return Math.max(0.05, Math.min(1, base + (Math.random() * 0.15)));
      });
      return NextResponse.json({ waveform: synthetic, source: 'synthetic' });
    }

    return NextResponse.json({ waveform: combined, source: 'tracks' });
  } catch (error) {
    console.error('Waveform fetch error:', error);
    return NextResponse.json({ error: 'Failed to get waveform' }, { status: 500 });
  }
}
