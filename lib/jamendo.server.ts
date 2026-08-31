/**
 * Server-only Jamendo catalogue access.
 *
 * The client ID stays on the server so public clients cannot spend the shared
 * API allowance directly. Results are restricted to downloadable CC0 or plain
 * CC BY tracks; the required artist, provider, source, and licence attribution
 * is preserved so it can be shown wherever the track plays.
 */
import 'server-only';

import { createHash } from 'node:crypto';
import { z } from 'zod';
import { getCachedJson, setCachedJson } from '@/lib/server-cache';
import { createServiceRoleSupabase } from '@/utils/supabase/service-role';
import type {
  JamendoBrowsePage,
  JamendoSearchTrack,
  SoundtrackAttribution,
} from '@/lib/music-library.types';

const JAMENDO_TRACKS_URL = 'https://api.jamendo.com/v3.0/tracks/';
const JAMENDO_TRACK_FILE_URL = 'https://api.jamendo.com/v3.0/tracks/file/';
const JAMENDO_RESPONSE_LIMIT_BYTES = 2 * 1024 * 1024;
const JAMENDO_SEARCH_CACHE_SECONDS = 60;
const JAMENDO_SEARCH_RESULT_LIMIT = 8;
const JAMENDO_SEARCH_FETCH_LIMIT = 50;
const JAMENDO_TRACK_SELECTION_CACHE_SECONDS = 5 * 60;
const JAMENDO_IMPORT_LOOKUP_ATTEMPTS = 3;
const JAMENDO_BROWSE_FETCH_LIMIT = 30;
const JAMENDO_BROWSE_MAX_OFFSET = 600;
// Availability and licence can change at the provider. Keep browse caching
// brief so a displayed track is unlikely to fail the import-time revalidation.
const JAMENDO_BROWSE_CACHE_SECONDS = 5 * 60;
const JAMENDO_CACHE_TABLE = 'jamendo_response_cache';
const JAMENDO_REQUEST_TIMEOUT_MS = 8_000;
const JAMENDO_DOWNLOAD_TIMEOUT_MS = 30_000;
const JAMENDO_MAX_AUDIO_BYTES = 50 * 1024 * 1024;
const JAMENDO_MIN_DURATION_SECONDS = 30;
const JAMENDO_MAX_DURATION_SECONDS = 10 * 60;

const JamendoHeadersSchema = z.object({
  status: z.string(),
  code: z.coerce.number().int(),
  error_message: z.string().optional().default(''),
});

const JamendoTrackSchema = z
  .object({
    id: z.string().regex(/^[0-9]+$/),
    name: z.string().trim().min(1).max(180),
    artist_name: z.string().trim().min(1).max(180),
    duration: z.coerce
      .number()
      .int()
      .min(JAMENDO_MIN_DURATION_SECONDS)
      .max(JAMENDO_MAX_DURATION_SECONDS),
    license_ccurl: z.string().url(),
    shareurl: z.string().url(),
    audio: z.string().url(),
    audiodownload: z.string().url(),
    audiodownload_allowed: z.boolean(),
    image: z.string().url().optional(),
    album_image: z.string().url().optional(),
    waveform: z.string().optional(),
  })
  .passthrough();

const JamendoResponseSchema = z.object({
  headers: JamendoHeadersSchema,
  results: z.array(z.unknown()),
});

type JamendoRawTrack = z.infer<typeof JamendoTrackSchema>;

export class JamendoConfigurationError extends Error {}
export class JamendoRequestError extends Error {}
export class JamendoTrackUnavailableError extends Error {}

export type JamendoImportTrack = JamendoSearchTrack;

/** Album/track artwork is only trusted when Jamendo serves it over HTTPS. */
function normaliseArtworkUrl(...candidates: Array<string | undefined>): string | null {
  for (const candidate of candidates) {
    if (candidate && isJamendoUrl(candidate)) return candidate;
  }
  return null;
}

function getJamendoClientId(): string {
  const clientId = process.env.JAMENDO_CLIENT_ID?.trim() ?? '';
  if (!/^[a-zA-Z0-9_-]{4,80}$/.test(clientId)) {
    throw new JamendoConfigurationError('Jamendo song search is not configured.');
  }
  return clientId;
}

function isJamendoUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      (url.hostname === 'jamendo.com' || url.hostname.endsWith('.jamendo.com'))
    );
  } catch {
    return false;
  }
}

function normaliseCreativeCommonsLicence(
  rawUrl: string,
): Pick<SoundtrackAttribution, 'licenceName' | 'licenceUrl'> | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.hostname.toLowerCase() !== 'creativecommons.org'
  ) {
    return null;
  }

  const match = url.pathname.match(
    /^\/(licenses\/by|publicdomain\/zero)\/([0-9]+(?:\.[0-9]+)?)\/$/,
  );
  if (!match) return null;
  const [, licencePath, version] = match;
  const licenceName =
    licencePath === 'publicdomain/zero'
      ? `CC0 ${version}`
      : `CC ${licencePath.replace('licenses/', '').toUpperCase()} ${version}`;
  return {
    licenceName,
    licenceUrl: `https://creativecommons.org/${licencePath}/${version}/`,
  };
}

const WAVEFORM_PEAKS = 64;

const CachedJamendoTrackSchema = z
  .object({
    provider: z.literal('jamendo'),
    trackId: z.string().regex(/^[0-9]+$/),
    title: z.string().trim().min(1).max(180),
    artist: z.string().trim().min(1).max(180),
    durationSeconds: z.coerce
      .number()
      .int()
      .min(JAMENDO_MIN_DURATION_SECONDS)
      .max(JAMENDO_MAX_DURATION_SECONDS),
    previewUrl: z.string().url(),
    imageUrl: z.string().url().nullable(),
    peaks: z.array(z.number().min(0).max(1)).max(WAVEFORM_PEAKS).nullable(),
    sourceUrl: z.string().url(),
    licenceName: z.string().trim().min(1).max(80),
    licenceUrl: z.string().url(),
  })
  .strict();

/** Parse Jamendo's waveform JSON and downsample to a fixed set of 0-1 amplitudes. */
function parseWaveformPeaks(raw: string | undefined): number[] | null {
  if (!raw) return null;
  let source: unknown;
  try {
    source = JSON.parse(raw);
  } catch {
    return null;
  }
  const peaks =
    typeof source === 'object' && source !== null && 'peaks' in source
      ? (source as { peaks: unknown }).peaks
      : null;
  if (!Array.isArray(peaks) || peaks.length === 0) return null;

  const buckets = new Array<number>(WAVEFORM_PEAKS).fill(0);
  const counts = new Array<number>(WAVEFORM_PEAKS).fill(0);
  for (let i = 0; i < peaks.length; i += 1) {
    const value = Number(peaks[i]);
    if (!Number.isFinite(value)) continue;
    const bucket = Math.min(WAVEFORM_PEAKS - 1, Math.floor((i / peaks.length) * WAVEFORM_PEAKS));
    buckets[bucket] += Math.abs(value);
    counts[bucket] += 1;
  }
  const averaged = buckets.map((sum, index) => (counts[index] ? sum / counts[index] : 0));
  const max = Math.max(...averaged, 1);
  // Normalise to 0-1 and keep a visible floor so quiet sections still render.
  return averaged.map((value) => Math.max(0.12, Math.min(1, value / max)));
}

function normaliseCachedTrack(value: unknown): JamendoImportTrack | null {
  const parsed = CachedJamendoTrackSchema.safeParse(value);
  if (!parsed.success) return null;
  const track = parsed.data;
  const licence = normaliseCreativeCommonsLicence(track.licenceUrl);
  if (
    !licence ||
    licence.licenceName !== track.licenceName ||
    track.sourceUrl !== `https://www.jamendo.com/track/${track.trackId}` ||
    !isJamendoUrl(track.previewUrl) ||
    (track.imageUrl !== null && !isJamendoUrl(track.imageUrl))
  ) {
    return null;
  }
  return track;
}

function normaliseTrack(raw: unknown): JamendoImportTrack | null {
  const parsed = JamendoTrackSchema.safeParse(raw);
  if (!parsed.success) return null;
  const track: JamendoRawTrack = parsed.data;
  if (
    !track.audiodownload_allowed ||
    !isJamendoUrl(track.audio) ||
    !isJamendoUrl(track.audiodownload)
  ) {
    return null;
  }
  const licence = normaliseCreativeCommonsLicence(track.license_ccurl);
  if (!licence) return null;

  const sourceUrl = `https://www.jamendo.com/track/${track.id}`;
  return {
    provider: 'jamendo',
    trackId: track.id,
    title: track.name,
    artist: track.artist_name,
    durationSeconds: track.duration,
    previewUrl: track.audio,
    imageUrl: normaliseArtworkUrl(track.image, track.album_image),
    peaks: parseWaveformPeaks(track.waveform),
    sourceUrl,
    ...licence,
  };
}

type JamendoFetchPage = {
  tracks: JamendoImportTrack[];
  /** Number of raw results Jamendo returned before licence/download filtering. */
  rawCount: number;
};

async function fetchJamendoPage(parameters: URLSearchParams): Promise<JamendoFetchPage> {
  parameters.set('client_id', getJamendoClientId());
  parameters.set('format', 'json');
  parameters.set('include', 'licenses musicinfo');
  parameters.set('imagesize', '200');
  parameters.set('audioformat', 'mp32');
  parameters.set('audiodlformat', 'mp32');
  // By-ID lookups are revalidated locally by normaliseTrack, while catalogue
  // queries use provider-side filters to avoid returning unsupported results.
  if (!parameters.has('id')) {
    parameters.set('ccnc', 'false');
    parameters.set('ccnd', 'false');
    parameters.set('ccsa', 'false');
    parameters.set(
      'durationbetween',
      `${JAMENDO_MIN_DURATION_SECONDS}_${JAMENDO_MAX_DURATION_SECONDS}`,
    );
  }

  let response: Response;
  try {
    response = await fetch(`${JAMENDO_TRACKS_URL}?${parameters.toString()}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(JAMENDO_REQUEST_TIMEOUT_MS),
      headers: { 'User-Agent': 'ShowCrafter-Jamendo/1.0' },
    });
  } catch (error) {
    throw new JamendoRequestError('Jamendo could not be reached.', { cause: error });
  }
  if (!response.ok) {
    throw new JamendoRequestError(`Jamendo returned HTTP ${response.status}.`);
  }

  const contentLength = Number(response.headers.get('content-length') ?? 0);
  if (contentLength > JAMENDO_RESPONSE_LIMIT_BYTES) {
    throw new JamendoRequestError('Jamendo returned an unexpectedly large response.');
  }
  const text = await response.text();
  if (text.length > JAMENDO_RESPONSE_LIMIT_BYTES) {
    throw new JamendoRequestError('Jamendo returned an unexpectedly large response.');
  }

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new JamendoRequestError('Jamendo returned invalid JSON.', { cause: error });
  }
  const parsed = JamendoResponseSchema.safeParse(value);
  if (!parsed.success) {
    throw new JamendoRequestError('Jamendo returned an unsupported response.');
  }
  if (parsed.data.headers.status !== 'success' || parsed.data.headers.code !== 0) {
    throw new JamendoRequestError(
      parsed.data.headers.error_message || 'Jamendo rejected the request.',
    );
  }

  return {
    tracks: parsed.data.results
      .map(normaliseTrack)
      .filter((track): track is JamendoImportTrack => track !== null),
    rawCount: parsed.data.results.length,
  };
}

async function fetchJamendoTracks(parameters: URLSearchParams): Promise<JamendoImportTrack[]> {
  return (await fetchJamendoPage(parameters)).tracks;
}

function searchCacheKey(query: string): string {
  const digest = createHash('sha256').update(query).digest('hex');
  return `showcrafter:jamendo:search:v5:${digest}`;
}

function toSearchTrack(track: JamendoImportTrack): JamendoSearchTrack {
  return {
    provider: track.provider,
    trackId: track.trackId,
    title: track.title,
    artist: track.artist,
    durationSeconds: track.durationSeconds,
    previewUrl: track.previewUrl,
    imageUrl: track.imageUrl,
    peaks: track.peaks,
    sourceUrl: track.sourceUrl,
    licenceName: track.licenceName,
    licenceUrl: track.licenceUrl,
  };
}

/** Read the durable Postgres cache. Best-effort: unconfigured or errored reads
 * behave as a miss so callers fall back to the fast cache or the live API. */
async function getDurableCache<T>(cacheKey: string): Promise<T | null> {
  const supabase = createServiceRoleSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from(JAMENDO_CACHE_TABLE)
      .select('payload, expires_at')
      .eq('cache_key', cacheKey)
      .maybeSingle();
    if (error || !data) return null;
    if (new Date(data.expires_at).getTime() <= Date.now()) return null;
    return data.payload as T;
  } catch (error) {
    console.error('[jamendo] durable cache read failed:', error);
    return null;
  }
}

/** Write-through to the durable Postgres cache. Best-effort; failures are logged
 * but never surfaced, so caching problems cannot break search or browse. */
async function setDurableCache(
  cacheKey: string,
  payload: unknown,
  ttlSeconds: number,
): Promise<void> {
  const supabase = createServiceRoleSupabase();
  if (!supabase) return;
  try {
    const { error } = await supabase.from(JAMENDO_CACHE_TABLE).upsert(
      {
        cache_key: cacheKey,
        payload: payload as never,
        expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'cache_key' },
    );
    if (error) console.error('[jamendo] durable cache write failed:', error);
  } catch (error) {
    console.error('[jamendo] durable cache write failed:', error);
  }
}

/** Fast in-memory/Redis cache, then durable Postgres cache. A durable hit
 * re-warms the fast layer so subsequent reads stay in memory. */
async function readJamendoCache<T>(cacheKey: string, fastTtlSeconds: number): Promise<T | null> {
  const fast = await getCachedJson<T>(cacheKey);
  if (fast) return fast;
  const durable = await getDurableCache<T>(cacheKey);
  if (durable) {
    await setCachedJson(cacheKey, durable, fastTtlSeconds);
    return durable;
  }
  return null;
}

async function writeJamendoCache<T>(
  cacheKey: string,
  value: T,
  fastTtlSeconds: number,
): Promise<void> {
  await setCachedJson(cacheKey, value, fastTtlSeconds);
  await setDurableCache(cacheKey, value, fastTtlSeconds);
}

function trackSelectionCacheKey(trackId: string): string {
  return `showcrafter:jamendo:track-selection:v1:${trackId}`;
}

/**
 * Preserve the exact server-validated tracks offered to the user. Jamendo's
 * by-ID catalogue lookup can intermittently return an empty result for an ID
 * that its browse endpoint and file endpoint both serve, so import may fall
 * back to this short-lived selection without trusting client metadata.
 */
async function cacheJamendoTrackSelections(tracks: JamendoSearchTrack[]): Promise<void> {
  if (tracks.length === 0) return;
  const uniqueTracks = [
    ...new Map(
      tracks
        .map(normaliseCachedTrack)
        .filter((track): track is JamendoImportTrack => track !== null)
        .map((track) => [track.trackId, track] as const),
    ).values(),
  ];
  if (uniqueTracks.length === 0) return;
  await Promise.all(
    uniqueTracks.map((track) =>
      setCachedJson(
        trackSelectionCacheKey(track.trackId),
        track,
        JAMENDO_TRACK_SELECTION_CACHE_SECONDS,
      ),
    ),
  );

  const supabase = createServiceRoleSupabase();
  if (!supabase) return;
  const now = Date.now();
  try {
    const { error } = await supabase.from(JAMENDO_CACHE_TABLE).upsert(
      uniqueTracks.map((track) => ({
        cache_key: trackSelectionCacheKey(track.trackId),
        payload: track as never,
        expires_at: new Date(now + JAMENDO_TRACK_SELECTION_CACHE_SECONDS * 1000).toISOString(),
        updated_at: new Date(now).toISOString(),
      })),
      { onConflict: 'cache_key' },
    );
    if (error) console.error('[jamendo] track selection cache write failed:', error);
  } catch (error) {
    console.error('[jamendo] track selection cache write failed:', error);
  }
}

async function getCachedJamendoTrackSelection(trackId: string): Promise<JamendoImportTrack | null> {
  const cached = await readJamendoCache<unknown>(
    trackSelectionCacheKey(trackId),
    JAMENDO_TRACK_SELECTION_CACHE_SECONDS,
  );
  return normaliseCachedTrack(cached);
}

export async function searchJamendoTracks(query: string): Promise<JamendoSearchTrack[]> {
  const normalisedQuery = query.trim().replace(/\s+/g, ' ').slice(0, 80);
  const cacheKey = searchCacheKey(normalisedQuery.toLowerCase());
  const cached = await readJamendoCache<JamendoSearchTrack[]>(
    cacheKey,
    JAMENDO_SEARCH_CACHE_SECONDS,
  );
  if (cached) return cached;

  // `namesearch` matches the query against track/album/artist names, so a search
  // for "amazing" returns tracks actually called that. Jamendo's `search`
  // parameter is a loose tag match that returns unrelated songs.
  const parameters = new URLSearchParams({
    limit: String(JAMENDO_SEARCH_FETCH_LIMIT),
    namesearch: normalisedQuery,
    type: 'single albumtrack',
  });
  const tracks = (await fetchJamendoTracks(parameters))
    .slice(0, JAMENDO_SEARCH_RESULT_LIMIT)
    .map(toSearchTrack);
  await Promise.all([
    writeJamendoCache(cacheKey, tracks, JAMENDO_SEARCH_CACHE_SECONDS),
    cacheJamendoTrackSelections(tracks),
  ]);
  return tracks;
}

// How many licence-filtered tracks a single browse page aims to return, and how
// many raw Jamendo windows it may scan to reach that target. Genre tags often
// filter out most rows, so a single window can return few or zero tracks; the
// accumulator keeps pulling windows until the target is met or the tag runs out.
const JAMENDO_BROWSE_DEFAULT_COUNT = 20;
const JAMENDO_BROWSE_MAX_COUNT = 30;
const JAMENDO_BROWSE_MAX_WINDOWS = 5;

function browseCacheKey(genre: string, offset: number, count: number): string {
  return `showcrafter:jamendo:browse:v5:${genre || 'all'}:${offset}:${count}`;
}

/**
 * Popular downloadable CC0/CC BY tracks for the browse grid. `genre` is an
 * optional Jamendo fuzzy tag. Because licence filtering drops most rows, this
 * accumulates whole raw windows until it has at least `count` playable tracks
 * (or the tag is exhausted), so pages are never unexpectedly empty and
 * `nextOffset` resumes cleanly without skipping or repeating tracks.
 */
export async function browseJamendoTracks(
  genre: string | null,
  offset: number,
  count: number,
): Promise<JamendoBrowsePage> {
  const safeOffset = Number.isFinite(offset)
    ? Math.min(Math.max(Math.trunc(offset), 0), JAMENDO_BROWSE_MAX_OFFSET)
    : 0;
  const targetCount = Number.isFinite(count)
    ? Math.min(Math.max(Math.trunc(count), 1), JAMENDO_BROWSE_MAX_COUNT)
    : JAMENDO_BROWSE_DEFAULT_COUNT;
  const normalisedGenre = (genre ?? '').trim().toLowerCase().slice(0, 40);
  const cacheKey = browseCacheKey(normalisedGenre, safeOffset, targetCount);
  const cached = await readJamendoCache<JamendoBrowsePage>(cacheKey, JAMENDO_BROWSE_CACHE_SECONDS);
  if (cached) return cached;

  const collected: JamendoSearchTrack[] = [];
  let cursor = safeOffset;
  let exhausted = false;

  for (let window = 0; window < JAMENDO_BROWSE_MAX_WINDOWS; window += 1) {
    if (collected.length >= targetCount || cursor > JAMENDO_BROWSE_MAX_OFFSET) break;
    const parameters = new URLSearchParams({
      limit: String(JAMENDO_BROWSE_FETCH_LIMIT),
      offset: String(cursor),
      order: 'popularity_month',
      type: 'single albumtrack',
    });
    if (normalisedGenre) parameters.set('fuzzytags', normalisedGenre);

    const { tracks, rawCount } = await fetchJamendoPage(parameters);
    collected.push(...tracks.map(toSearchTrack));
    cursor += JAMENDO_BROWSE_FETCH_LIMIT;
    if (rawCount < JAMENDO_BROWSE_FETCH_LIMIT) {
      exhausted = true;
      break;
    }
  }

  const page: JamendoBrowsePage = {
    tracks: collected,
    nextOffset: cursor,
    hasMore: !exhausted && cursor <= JAMENDO_BROWSE_MAX_OFFSET,
  };
  // Do not persist an empty page: it is usually transient (a sparse offset), and
  // caching it would wrongly show "no tracks" after the provider recovers.
  if (collected.length > 0) {
    await Promise.all([
      writeJamendoCache(cacheKey, page, JAMENDO_BROWSE_CACHE_SECONDS),
      cacheJamendoTrackSelections(collected),
    ]);
  }
  return page;
}

export async function getJamendoTrackForImport(trackId: string): Promise<JamendoImportTrack> {
  const cachedSelection = await getCachedJamendoTrackSelection(trackId);
  if (cachedSelection) return cachedSelection;

  let requestError: JamendoRequestError | null = null;

  for (let attempt = 0; attempt < JAMENDO_IMPORT_LOOKUP_ATTEMPTS; attempt += 1) {
    try {
      const tracks = await fetchJamendoTracks(
        new URLSearchParams({
          id: trackId,
          limit: '1',
        }),
      );
      const track = tracks.find((candidate) => candidate.trackId === trackId);
      if (track) return track;
    } catch (error) {
      if (!(error instanceof JamendoRequestError)) throw error;
      requestError = error;
    }
  }

  if (requestError) throw requestError;
  throw new JamendoTrackUnavailableError(
    'This Jamendo track is unavailable under a supported licence.',
  );
}

export function isTrustedJamendoAudioUrl(value: string): boolean {
  return isJamendoUrl(value);
}

async function fetchJamendoDownload(trackId: string): Promise<Response> {
  const parameters = new URLSearchParams({
    client_id: getJamendoClientId(),
    id: trackId,
    audioformat: 'mp32',
    action: 'download',
  });
  let currentUrl = `${JAMENDO_TRACK_FILE_URL}?${parameters.toString()}`;

  // Validate each redirect before following it. This keeps the client ID on the
  // official API request and prevents a provider response becoming an SSRF hop.
  for (let redirectCount = 0; redirectCount < 4; redirectCount += 1) {
    let response: Response;
    try {
      response = await fetch(currentUrl, {
        cache: 'no-store',
        redirect: 'manual',
        signal: AbortSignal.timeout(JAMENDO_DOWNLOAD_TIMEOUT_MS),
        headers: { 'User-Agent': 'ShowCrafter-Jamendo/1.0' },
      });
    } catch (error) {
      throw new JamendoRequestError('The Jamendo track could not be downloaded.', {
        cause: error,
      });
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        throw new JamendoRequestError('Jamendo returned an incomplete audio redirect.');
      }
      const nextUrl = new URL(location, currentUrl).toString();
      if (!isTrustedJamendoAudioUrl(nextUrl)) {
        throw new JamendoTrackUnavailableError('Jamendo returned an invalid audio location.');
      }
      currentUrl = nextUrl;
      continue;
    }

    if (response.status === 403 || response.status === 404 || response.status === 410) {
      throw new JamendoTrackUnavailableError('This Jamendo track is no longer downloadable.');
    }
    if (!response.ok || !isTrustedJamendoAudioUrl(response.url)) {
      throw new JamendoRequestError(`Jamendo returned HTTP ${response.status} for the audio file.`);
    }
    return response;
  }

  throw new JamendoRequestError('Jamendo returned too many audio redirects.');
}

function looksLikeMp3(prefix: Uint8Array): boolean {
  return (
    (prefix.length >= 3 &&
      prefix[0] === 'I'.charCodeAt(0) &&
      prefix[1] === 'D'.charCodeAt(0) &&
      prefix[2] === '3'.charCodeAt(0)) ||
    (prefix.length >= 2 && prefix[0] === 0xff && (prefix[1] & 0xe0) === 0xe0)
  );
}

export async function downloadJamendoTrack(track: JamendoImportTrack): Promise<{
  bytes: Uint8Array;
  contentType: 'audio/mpeg';
  sizeBytes: number;
}> {
  const response = await fetchJamendoDownload(track.trackId);

  // Jamendo's download host mislabels valid MP3s with a text/html content type,
  // so the response header cannot be trusted. The MP3 magic-byte check on the
  // downloaded bytes (looksLikeMp3, below) is the real and sufficient gate.
  const declaredSize = Number(response.headers.get('content-length') ?? 0);
  if (declaredSize > JAMENDO_MAX_AUDIO_BYTES) {
    throw new JamendoTrackUnavailableError('This Jamendo track is larger than 50 MB.');
  }
  if (!response.body) {
    throw new JamendoRequestError('Jamendo returned an empty audio response.');
  }

  const chunks: Uint8Array[] = [];
  const reader = response.body.getReader();
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > JAMENDO_MAX_AUDIO_BYTES) {
      await reader.cancel();
      throw new JamendoTrackUnavailableError('This Jamendo track is larger than 50 MB.');
    }
    chunks.push(value);
  }
  if (totalBytes === 0) {
    throw new JamendoRequestError('Jamendo returned an empty audio file.');
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  if (!looksLikeMp3(bytes.subarray(0, 3))) {
    throw new JamendoRequestError('Jamendo did not return a valid MP3 file.');
  }
  return { bytes, contentType: 'audio/mpeg', sizeBytes: totalBytes };
}
