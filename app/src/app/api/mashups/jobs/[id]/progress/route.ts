import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { getJobProgress } from '@/lib/audio/execution';

/**
 * GET /api/mashups/jobs/[id]/progress
 * 
 * Get the progress of a specific job. Supports both polling and SSE.
 * 
 * Query parameters:
 * - stream: If 'true', use Server-Sent Events for real-time updates
 * - poll: If 'true', return current status (default)
 * 
 * Response (polling):
 * {
 *   jobId: string;
 *   status: 'queued' | 'validating' | 'analyzing' | 'planning' | 'rendering' | 'mixing' | 'finalizing' | 'completed' | 'failed' | 'cancelled';
 *   progressPercent: number;
 *   currentStep: string;
 *   estimatedTimeRemainingSeconds: number | null;
 *   startedAt: string | null;
 *   completedAt: string | null;
 *   errorMessage: string | null;
 * }
 * 
 * Response (SSE):
 * event: progress
data: { ... }
 * 
event: complete
data: { ... }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: jobId } = await params;
    const { searchParams } = new URL(request.url);
    const useStream = searchParams.get('stream') === 'true';

    if (useStream) {
      // SSE implementation
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          
          // Send initial status
          const progress = await getJobProgress(jobId);
          if (!progress) {
            controller.enqueue(encoder.encode('event: error\ndata: Job not found\n\n'));
            controller.close();
            return;
          }
          
          controller.enqueue(
            encoder.encode(`event: progress\ndata: ${JSON.stringify(progress)}\n\n`)
          );
          
          // If completed, close immediately
          if (progress.status === 'completed' || progress.status === 'failed') {
            controller.enqueue(
              encoder.encode(`event: ${progress.status}\ndata: ${JSON.stringify(progress)}\n\n`)
            );
            controller.close();
            return;
          }
          
          // Poll for updates every 2 seconds (simplified SSE)
          const interval = setInterval(async () => {
            try {
              const updated = await getJobProgress(jobId);
              if (!updated) {
                clearInterval(interval);
                controller.close();
                return;
              }
              
              controller.enqueue(
                encoder.encode(`event: progress\ndata: ${JSON.stringify(updated)}\n\n`)
              );
              
              if (updated.status === 'completed' || updated.status === 'failed') {
                controller.enqueue(
                  encoder.encode(`event: ${updated.status}\ndata: ${JSON.stringify(updated)}\n\n`)
                );
                clearInterval(interval);
                controller.close();
              }
            } catch {
              clearInterval(interval);
              controller.close();
            }
          }, 2000);
          
          // Cleanup on abort
          request.signal.addEventListener('abort', () => {
            clearInterval(interval);
            controller.close();
          });
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Polling response
    const progress = await getJobProgress(jobId);
    if (!progress) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json(progress);
  } catch (error) {
    console.error('Job progress error:', error);
    return NextResponse.json(
      { error: 'Failed to get job progress' },
      { status: 500 }
    );
  }
}
