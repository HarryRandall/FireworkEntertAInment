/** Private-key music search and cookie-authenticated soundtrack changes. */
import { configuredMusicProvider } from '@/lib/shopper/music/configured-provider';
import { musicQuerySchema } from '@/lib/shopper/music/contracts';
import { z } from 'zod';
import { readSoundtrack } from '@/lib/shopper/music/readers';
import { changeSoundtrack } from '@/lib/shopper/music/actions';

const BAD_REQUEST = 400; // HTTP status for malformed shopper input.
const PROVIDER_UNAVAILABLE = 503; // HTTP status for a failed upstream music read.
/** Returns cached provider results or an explicit unconfigured state; never echoes credentials. */
export async function GET(request: Request) {
  const session = new URL(request.url).searchParams.get('session');
  if (session !== null) return analysisStatus(session);
  const provider = configuredMusicProvider();
  if (!provider) return Response.json({ status: 'not_configured', tracks: [] });
  const query = musicQuerySchema.safeParse(new URL(request.url).searchParams.get('q') ?? '');
  if (!query.success)
    return Response.json(
      { status: 'invalid', message: 'Use a shorter search.' },
      { status: BAD_REQUEST },
    );
  if (query.data === '') return Response.json({ status: 'ok', tracks: [] });
  try {
    return Response.json({ status: 'ok', tracks: await provider.search(query.data) });
  } catch {
    return Response.json(
      { status: 'error', message: 'Music search could not load. Please try again.' },
      { status: PROVIDER_UNAVAILABLE },
    );
  }
}
/** Mutates only a cookie-owned plan and rejects cross-origin writes before reading the body. */
export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin)
    return Response.json(
      { status: 'invalid', message: 'This request is unavailable.' },
      { status: BAD_REQUEST },
    );
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json(
      { status: 'invalid', message: 'Please reload your plan.' },
      { status: BAD_REQUEST },
    );
  }
  return Response.json(await changeSoundtrack(raw));
}

async function analysisStatus(session: string) {
  const parsed = z.string().uuid().safeParse(session);
  if (!parsed.success) return Response.json({ ready: false }, { status: BAD_REQUEST });
  const selected = await readSoundtrack(parsed.data);
  return Response.json({ ready: selected !== null && selected.analysis_id !== null });
}
