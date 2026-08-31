/**
 * Compatibility re-export of the new `lib/cue-generation/*` module set.
 *
 * The original 506-line file was split along its natural seams:
 * `schemas.ts` (zod + types), `prompt.ts` (system prompt + projections),
 * `llm.ts` (provider error/parse helpers), `loaders.server.ts` (DB I/O),
 * and `runner.server.ts` (the orchestration). This barrel preserves the
 * `@/lib/cue-generation.server` import path.
 */
import 'server-only';

export * from '@/lib/cue-generation/index';
