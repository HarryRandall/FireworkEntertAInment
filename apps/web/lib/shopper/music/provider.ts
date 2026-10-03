/** Provider interface isolates validated, cached Jamendo reads from shopper routes. */
import { z } from 'zod';
import { musicTrackSchema, musicQuerySchema, type MusicTrack } from './contracts';

const MS_PER_SECOND = 1000; // Provider durations are seconds; stored tracks use milliseconds.
const CACHE_TTL_MS = 300000; // Five-minute operational cache limits repeat provider searches.
const MAX_CACHE_ENTRIES = 100; // Process-local cache budget, including requests in flight.
const SEARCH_LIMIT = 20; // Product choice: one bounded page of track results.
const REQUEST_TIMEOUT_MS = 10000; // Ten-second provider response deadline.
const envelopeSchema = z.object({
  headers: z.object({ code: z.number(), status: z.string() }),
  results: z.array(z.unknown()).max(SEARCH_LIMIT),
});
const rawTrackSchema = z.object({
  id: z.string(),
  name: z.string(),
  artist_name: z.string(),
  duration: z.number(),
  audio: z.string(),
  license_ccurl: z.string(),
});
/** Provider capabilities use a shared, private credential and return validated metadata only. */
export interface MusicProvider {
  search(query: string): Promise<MusicTrack[]>;
  track(id: string): Promise<MusicTrack | null>;
}
function normaliseTrack(raw: unknown): MusicTrack {
  const track = rawTrackSchema.parse(raw);
  // CC URL path carries the attribution licence identifier and version.
  const licenceUrl = new URL(track.license_ccurl);
  const segments = licenceUrl.pathname.split('/').filter(Boolean);
  const licence = segments.at(1) === 'zero' ? '0' : segments.at(1)?.toUpperCase();
  if (licenceUrl.protocol === 'http:') licenceUrl.protocol = 'https:';
  const version = segments.at(2);
  return musicTrackSchema.parse({
    provider_track_id: track.id,
    title: track.name,
    artist: track.artist_name,
    duration_ms: Math.round(track.duration * MS_PER_SECOND),
    audio_url: track.audio,
    licence_code: `CC-${licence ?? ''}-${version ?? ''}`,
    licence_url: licenceUrl.href,
    attribution: `${track.name} by ${track.artist_name} · Jamendo · CC-${licence ?? ''}-${version ?? ''}`,
  });
}
/** Creates an injectable provider; fetch is invoked only by explicit search or identity lookup. */
export function jamendoProvider(
  key: string,
  request: typeof fetch = fetch,
  now = Date.now,
): MusicProvider {
  const cache = new Map<string, { expires: number; result: Promise<MusicTrack[]> }>();
  function read(parameters: Record<string, string>): Promise<MusicTrack[]> {
    const cacheKey = JSON.stringify(parameters);
    const hit = cache.get(cacheKey);
    if (hit && hit.expires > now()) return hit.result;
    const result = fetchTracks(key, parameters, request);
    if (cache.size >= MAX_CACHE_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(cacheKey, { expires: now() + CACHE_TTL_MS, result });
    // Failed reads must be retryable rather than cached as an empty successful search.
    void result.catch(() => {
      if (cache.get(cacheKey)?.result === result) cache.delete(cacheKey);
    });
    return result;
  }
  return {
    async search(query) {
      return read({
        search: musicQuerySchema.parse(query).toLowerCase(),
        limit: String(SEARCH_LIMIT),
      });
    },
    async track(id) {
      const identity = z.string().regex(/^\d+$/).parse(id);
      const results = await read({ id: identity, limit: '1' });
      return results.find((track) => track.provider_track_id === identity) ?? null;
    },
  };
}
async function fetchTracks(key: string, parameters: Record<string, string>, request: typeof fetch) {
  const url = new URL('https://api.jamendo.com/v3.0/tracks/');
  url.search = new URLSearchParams({
    client_id: key,
    format: 'json',
    audioformat: 'mp32',
    ...parameters,
  }).toString();
  let response: Response;
  try {
    response = await request(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      redirect: 'error',
      cache: 'no-store',
    });
  } catch {
    // Transport errors may contain the credential-bearing request URL. Never propagate it.
    throw new Error('Music provider transport failed');
  }
  if (!response.ok) throw new Error('Music provider response failed');
  const envelope = envelopeSchema.parse(await response.json());
  if (envelope.headers.code !== 0 || envelope.headers.status !== 'success')
    throw new Error('Music provider rejected request');
  return envelope.results.map(normaliseTrack);
}
