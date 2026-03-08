import { NextRequest, NextResponse } from 'next/server';

export async function POST(_request: NextRequest) {
  return NextResponse.json(
    {
      error:
        'Stem mashup generation is deprecated during runtime unification. The authoritative Phase 0 runtime only supports queued analysis, stem separation, standard mix, and Auto DJ mix generation.',
    },
    { status: 501 }
  );
}
