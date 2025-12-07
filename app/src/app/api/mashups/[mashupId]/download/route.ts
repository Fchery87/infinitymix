import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { db } from '@/lib/db';
import { mashups } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: { mashupId: string } }
) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { mashupId } = params;

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

    // TODO: Generate and return a temporary signed URL for download
    // For now, return the storage URL directly
    const response = await fetch(mashup.outputStorageUrl);
    
    if (!response.ok) {
      return NextResponse.json(
        { error: 'File not available for download' },
        { status: 500 }
      );
    }

    // Increment download count
    await db
      .update(mashups)
      .set({
        downloadCount: mashups.downloadCount + 1,
        updatedAt: new Date(),
      })
      .where(eq(mashups.id, mashupId));

    // Get file data
    const fileBuffer = await response.arrayBuffer();
    const fileName = `InfinityMix_Mashup_${new Date().toISOString().replace(/[:.]/g, '-')}.${mashup.outputFormat}`;

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': mashup.outputFormat === 'mp3' ? 'audio/mpeg' : 'audio/wav',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': fileBuffer.byteLength.toString(),
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
