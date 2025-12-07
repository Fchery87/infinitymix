import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { db } from '@/lib/db';
import { mashups } from '@/lib/db/schema';
import { getStorage } from '@/lib/storage';
import { logTelemetry } from '@/lib/telemetry';
import { eq, and, sql } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any
) {
  try {
    const { params } = context || {};
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const mashupId = params?.mashupId;

    if (!mashupId) {
      return NextResponse.json(
        { error: 'Mashup ID is required' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const streamOnly = searchParams.get('stream') === 'true';

    // Get mashup details
    const [mashup] = await db
      .select({
        id: mashups.id,
        generationStatus: mashups.generationStatus,
        outputStorageUrl: mashups.outputStorageUrl,
        outputFormat: mashups.outputFormat,
        userId: mashups.userId,
      })
      .from(mashups)
      .where(and(
        eq(mashups.id, mashupId),
        eq(mashups.userId, session.user.id)
      ));

    if (!mashup) {
      return NextResponse.json(
        { error: 'Mashup not found' },
        { status: 404 }
      );
    }

    if (mashup.generationStatus !== 'completed' || !mashup.outputStorageUrl) {
      return NextResponse.json(
        { error: 'Mashup not ready for download' },
        { status: 409 }
      );
    }

    const storage = await getStorage();
    let fileBuffer: ArrayBuffer;
    let mimeType = mashup.outputFormat === 'mp3' ? 'audio/mpeg' : 'audio/wav';

    if (storage.getFile) {
      const stored = await storage.getFile(mashup.outputStorageUrl);
      if (!stored) {
        return NextResponse.json(
          { error: 'File not available for download' },
          { status: 500 }
        );
      }
      fileBuffer = stored.buffer;
      mimeType = stored.mimeType || mimeType;
    } else {
      const response = await fetch(mashup.outputStorageUrl);
      if (!response.ok) {
        return NextResponse.json(
          { error: 'File not available for download' },
          { status: 500 }
        );
      }
      fileBuffer = await response.arrayBuffer();
      mimeType = response.headers.get('content-type') || mimeType;
    }

    if (!streamOnly) {
      await db
        .update(mashups)
        .set({
          downloadCount: sql`${mashups.downloadCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(mashups.id, mashupId));
    }

    logTelemetry({
      name: 'mashup.download',
      properties: {
        mashupId,
        userId: session.user.id,
        streamOnly,
        outputFormat: mashup.outputFormat,
      },
    });

    const buffer = Buffer.from(fileBuffer);
    const fileName = `InfinityMix_Mashup_${new Date().toISOString().replace(/[:.]/g, '-')}.${mashup.outputFormat}`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': streamOnly ? 'inline' : `attachment; filename="${fileName}"`,
        'Content-Length': buffer.byteLength.toString(),
        'Cache-Control': 'private, max-age=0',
      },
    });
  } catch (error) {
    console.error('Download mashup error:', error);
    return NextResponse.json(
      { error: 'Failed to download mashup' },
      { status: 500 }
    );
  }
}
