import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { mashups } from '@/lib/db/schema';
import { getStorage } from '@/lib/storage';
import { logTelemetry } from '@/lib/telemetry';
import { log } from '@/lib/logger';
import { eq, and, sql } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mashupId: string }> }
) {
  try {
    const { mashupId } = await params;
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
        eq(mashups.userId, user.id)
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

    console.log(`📥 Download: Fetching mashup ${mashupId} from ${mashup.outputStorageUrl}`);

    if (storage.getFile) {
      const stored = await storage.getFile(mashup.outputStorageUrl);
      if (!stored) {
        console.error(`❌ Download: File not found in storage for ${mashupId}`);
        return NextResponse.json(
          { error: 'File not available for download' },
          { status: 500 }
        );
      }
      fileBuffer = stored.buffer;
      mimeType = stored.mimeType || mimeType;
      console.log(`✅ Download: Got ${fileBuffer.byteLength} bytes, mime=${mimeType}`);
    } else {
      console.log(`⚠️ Download: No getFile, fetching directly from URL`);
      const response = await fetch(mashup.outputStorageUrl);
      if (!response.ok) {
        console.error(`❌ Download: Direct fetch failed for ${mashupId}`);
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
        userId: user.id,
        streamOnly,
        outputFormat: mashup.outputFormat,
      },
    });
    log('info', 'mashup.download', {
      mashupId,
      userId: user.id,
      streamOnly,
      outputFormat: mashup.outputFormat,
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
