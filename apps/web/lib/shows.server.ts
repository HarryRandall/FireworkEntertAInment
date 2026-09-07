/**
 * Compatibility re-export of the new `lib/shows/*` module set.
 *
 * The original ~580-line file was split into focused modules:
 * `types.ts`, `mappers.ts`, `cache-keys.ts`, `queries.server.ts`,
 * `shopping.server.ts`, `mutations.server.ts`, and `audio.server.ts`.
 * This barrel preserves the `@/lib/shows.server` import path so existing
 * callers don't need to change.
 */
import 'server-only';

export * from '@/lib/shows/index';
