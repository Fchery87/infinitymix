import { NextRequest } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { getMashupStatusForUser } from '@/lib/runtime/mashup-status';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const POLL_INTERVAL_MS = 2000;
const HEARTBEAT_INTERVAL_MS = 15000;

function encodeSseChunk(event: string, data: unknown) {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mashupId: string }> }
) {
  const user = await getSessionUser(request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { mashupId } = await params;
  if (!mashupId) {
    return new Response(JSON.stringify({ error: 'Mashup ID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const initialSnapshot = await getMashupStatusForUser({ mashupId, userId: user.id });
  if (!initialSnapshot) {
    return new Response(JSON.stringify({ error: 'Mashup not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let previousSerialized = '';
      let statusTimer: ReturnType<typeof setInterval> | null = null;
      let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

      const close = () => {
        if (closed) return;
        closed = true;
        if (statusTimer) clearInterval(statusTimer);
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        controller.close();
      };

      const sendSnapshot = async () => {
        if (closed) return;

        try {
          const snapshot = await getMashupStatusForUser({ mashupId, userId: user.id });
          if (!snapshot) {
            controller.enqueue(encodeSseChunk('error', { error: 'Mashup not found' }));
            close();
            return;
          }

          const serialized = JSON.stringify(snapshot);
          if (serialized !== previousSerialized) {
            previousSerialized = serialized;
            controller.enqueue(encodeSseChunk('status', snapshot));
          }

          if (snapshot.status === 'completed' || snapshot.status === 'failed') {
            controller.enqueue(encodeSseChunk('end', { status: snapshot.status }));
            close();
          }
        } catch (error) {
          controller.enqueue(
            encodeSseChunk('error', {
              error: error instanceof Error ? error.message : 'Failed to stream mashup status',
            })
          );
          close();
        }
      };

      request.signal.addEventListener('abort', close);

      void sendSnapshot();
      statusTimer = setInterval(() => {
        void sendSnapshot();
      }, POLL_INTERVAL_MS);
      heartbeatTimer = setInterval(() => {
        if (!closed) {
          controller.enqueue(new TextEncoder().encode(': keep-alive\n\n'));
        }
      }, HEARTBEAT_INTERVAL_MS);
    },
    cancel() {
      request.signal.removeEventListener('abort', () => undefined);
    },
  });

  return new Response(stream, {
    headers: {
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Content-Type': 'text/event-stream',
      'X-Accel-Buffering': 'no',
    },
  });
}
