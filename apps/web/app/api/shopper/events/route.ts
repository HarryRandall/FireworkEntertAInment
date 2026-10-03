/** Cookie-bound analytics transport keeps every event behind the existing ownership RPC. */
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { batchSchema } from '@/lib/shopper/events/contracts';
// HTTP status codes describe boundary failures, independent of shopper UI state.
const BAD_REQUEST = 400;
const FORBIDDEN = 403;
const SERVER_ERROR = 500;
const BODY_LIMIT_BYTES = 16384; // Transport budget below the browser's 64 KiB keepalive allowance.
/** Validates a same-origin bounded batch and appends each event with the caller's Auth identity. */
export async function POST(request: Request): Promise<Response> {
  if (request.headers.get('origin') !== new URL(request.url).origin)
    return new Response(null, { status: FORBIDDEN });
  const text = await request.text();
  if (new TextEncoder().encode(text).length > BODY_LIMIT_BYTES)
    return new Response(null, { status: BAD_REQUEST });
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    return new Response(null, { status: BAD_REQUEST });
  }
  const parsed = batchSchema.safeParse(input);
  if (!parsed.success) return new Response(null, { status: BAD_REQUEST });
  try {
    const client = createClient(await cookies());
    let failed = false;
    for (const event of parsed.data.events) {
      const { error } = await client.rpc('track_event', {
        ...event,
        session_key: parsed.data.session_key,
      });
      if (error) {
        failed = true;
        console.error('Shopper event rejected', error.code);
      }
    }
    return Response.json({ accepted: !failed }, { status: failed ? SERVER_ERROR : undefined });
  } catch (error) {
    console.error('Shopper event transport failed', error);
    return new Response(null, { status: SERVER_ERROR });
  }
}
