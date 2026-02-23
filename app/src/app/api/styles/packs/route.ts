import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { listBuiltInStylePackSummaries } from '@/lib/styles/style-packs';
import { validateStylePack } from '@/lib/styles/style-pack-validator';

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    builtInStylePacks: listBuiltInStylePackSummaries(),
  });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { stylePack?: unknown };
    const result = validateStylePack(body?.stylePack);
    if (!result.valid) {
      return NextResponse.json(
        {
          valid: false,
          errors: result.errors,
        },
        { status: 400 }
      );
    }
    return NextResponse.json({
      valid: true,
      stylePack: result.stylePack,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to validate style pack', message: (error as Error).message },
      { status: 500 }
    );
  }
}
