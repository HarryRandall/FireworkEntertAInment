/** Validated Jamendo display facts and owned soundtrack clocks at the web boundary. */
import { z } from 'zod';
import { musicAnalysisSchema } from '@showcrafter/planner/music';

const MAX_QUERY_LENGTH = 100; // Product input budget in characters for a track or artist search.
const MAX_METADATA_LENGTH = 500; // Defensive provider text bound in characters.
const MAX_TRACK_DURATION_MS = 3600000; // One-hour input ceiling in milliseconds for shopper soundtracks.
const AUDIO_HOSTS = [
  'prod-1.storage.jamendo.com',
  'prod-2.storage.jamendo.com',
  'storage.jamendo.com',
];
/** Restricts audio to the same HTTPS provider origins approved for the worker. */
const providerAudioSchema = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      AUDIO_HOSTS.includes(url.hostname) &&
      !url.searchParams.has('client_id') &&
      url.port === '' &&
      url.username === '' &&
      url.password === ''
    );
  });
const licenceUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname === 'creativecommons.org' &&
      url.port === '' &&
      url.username === '' &&
      url.password === ''
    );
  });
/** Search terms are normalised before cache lookup, with no arbitrary provider parameters. */
export const musicQuerySchema = z.string().trim().max(MAX_QUERY_LENGTH);
/** Trusted import metadata originates from a fresh provider lookup, never a client result card. */
export const musicTrackSchema = z
  .object({
    provider_track_id: z.string().regex(/^\d+$/),
    title: z.string().min(1).max(MAX_METADATA_LENGTH),
    artist: z.string().min(1).max(MAX_METADATA_LENGTH),
    duration_ms: z.number().int().positive().max(MAX_TRACK_DURATION_MS),
    audio_url: providerAudioSchema,
    licence_code: z.string().regex(/^CC-(?:BY(?:-NC)?(?:-SA|-ND)?|0)-\d+\.\d+$/),
    licence_url: licenceUrlSchema,
    attribution: z.string().min(1).max(MAX_METADATA_LENGTH),
  })
  .strict();
/** One safe track card with millisecond duration and mandatory licence attribution. */
export type MusicTrack = z.infer<typeof musicTrackSchema>;
/** Ownership-fenced music facts; analysis times remain seconds from audio origin. */
export const soundtrackSchema = z.object({
  track_id: z.string().uuid(),
  provider_track_id: z.string(),
  title: z.string(),
  artist: z.string().nullable(),
  licence_code: z.string(),
  licence_url: licenceUrlSchema.nullable(),
  attribution: z.string().nullable(),
  source_audio_url: providerAudioSchema.nullable(),
  audio_media_id: z.string().uuid().nullable(),
  analysis_id: z.string().uuid().nullable(),
  analysis: musicAnalysisSchema.nullable(),
  pinned_analysis_id: z.string().uuid().nullable(),
  playback_url: z.string().url().nullable(),
  offset_ms: z.number().int().default(0),
});
/** Selected soundtrack, including the analysis identity used by its candidate. */
export type Soundtrack = z.infer<typeof soundtrackSchema>;
/** Music mutations carry the displayed revision and a provider identity, not editable metadata. */
export const musicRequestSchema = z
  .object({
    session: z.string().uuid(),
    candidate: z.string().uuid(),
    revision: z.number().int().nonnegative(),
    track: z.string().regex(/^\d+$/).nullable(),
    refresh: z.boolean().default(false),
  })
  .strict();
