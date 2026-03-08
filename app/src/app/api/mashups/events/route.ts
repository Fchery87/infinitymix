import { NextRequest } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { getMashupListForUser } from '@/lib/runtime/mashup-list';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const LIST_LIMIT = 25;
const STREAM_INTERVAL_MS = 2500;
const HEARTBEAT_INTERVAL_MS = 15000;

function encodeSseChunk(event: string, data: unknown) {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let previousSerialized = '';
      let listTimer: ReturnType<typeof setInterval> | null = null;
      let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

      const close = () => {
        if (closed) return;
        closed = true;
        if (listTimer) clearInterval(listTimer);
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        controller.close();
      };

      const sendSnapshot = async () => {
        if (closed) return;
        try {
          const snapshot = await getMashupListForUser({
            userId: user.id,
            page: 1,
            limit: LIST_LIMIT,
          });
          const serialized = JSON.stringify(snapshot);
          if (serialized !== previousSerialized) {
            previousSerialized = serialized;
            controller.enqueue(encodeSseChunk('mashups', snapshot));
          }
        } catch (error) {
          controller.enqueue(
            encodeSseChunk('error', {
              error: error instanceof Error ? error.message : 'Failed to stream mashups',
            })
          );
          close();
        }
      };

      request.signal.addEventListener('abort', close);
      void sendSnapshot();
      listTimer = setInterval(() => {
        void sendSnapshot();
      }, STREAM_INTERVAL_MS);
      heartbeatTimer = setInterval(() => {
        if (!closed) {
          controller.enqueue(new TextEncoder().encode(': keep-alive\n\n'));
        }
      }, HEARTBEAT_INTERVAL_MS);
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
