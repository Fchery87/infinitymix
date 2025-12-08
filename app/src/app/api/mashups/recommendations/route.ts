import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { uploadedTracks } from '@/lib/db/schema';
import { overallCompatibility } from '@/lib/utils/audio-compat';
import { and, eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const tracks = await db
      .select()
      .from(uploadedTracks)
      .where(and(eq(uploadedTracks.userId, user.id), eq(uploadedTracks.analysisStatus, 'completed')));

    if (tracks.length < 2) {
      return NextResponse.json({ track_ids: [], rationale: 'Not enough analyzed tracks' });
    }

    const anchor = [...tracks]
      .sort((a, b) => Number((b.bpmConfidence ?? 0)) + Number((b.keyConfidence ?? 0)) - (Number((a.bpmConfidence ?? 0)) + Number((a.keyConfidence ?? 0))))
      .at(0) ?? tracks[0];

    const anchorBpm = anchor.bpm ? Number(anchor.bpm) : null;
    const anchorCamelot = anchor.camelotKey ?? anchor.keySignature;

    const scored = tracks
      .filter((t) => t.id !== anchor.id)
      .map((t) => {
        const candidateBpm = t.bpm ? Number(t.bpm) : null;
        const { score, bpmDiff, keyOk } = overallCompatibility(anchorBpm, anchorCamelot, { bpm: candidateBpm, camelotKey: t.camelotKey ?? t.keySignature });
        const phraseBoost = Array.isArray(t.dropMoments) && t.dropMoments.length > 0 ? 0.05 : 0;
        const structureBoost = Array.isArray(t.structure) && t.structure.some((s) => s.label === 'chorus') ? 0.05 : 0;
        return { track: t, score: Number((score + phraseBoost + structureBoost).toFixed(3)), bpmDiff, keyOk };
      })
      .sort((a, b) => b.score - a.score);

    const suggested = scored.slice(0, 3).map((s) => s.track.id);
    const rationale = scored.slice(0, 3).map((s) => ({ id: s.track.id, score: s.score, key_ok: s.keyOk, bpm_diff: s.bpmDiff }));

    return NextResponse.json({
      anchor_track_id: anchor.id,
      track_ids: [anchor.id, ...suggested],
      rationale,
    });
  } catch (error) {
    console.error('recommendations error', error);
    return NextResponse.json({ error: 'Failed to build recommendations' }, { status: 500 });
  }
}
