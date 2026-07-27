/**
 * Zod schemas + shared types for cue generation.
 *
 * The LLM is told to emit `{ cues: [{ slotIndex, productId, emphasis? }, ...], rationale? }`.
 * These schemas enforce that contract before we trust the response.
 */
import { z } from 'zod';

/** Per-cue render emphasis the model may override. */
export const CUE_EMPHASIS_VALUES = ['normal', 'accent', 'peak'] as const;
export type CueEmphasis = (typeof CUE_EMPHASIS_VALUES)[number];

/** A single LLM assignment of a product to a slot. */
export const AssignmentSchema = z.object({
  slotIndex: z.number().int().min(0),
  productId: z.string().uuid(),
  // Optional for compatibility with older/custom prompts. The persisted cue
  // label comes from the canonical catalogue product, so forcing the model to
  // write hundreds of discarded sentences only increased latency.
  description: z.string().trim().min(1).max(180).optional(),
  emphasis: z.enum(CUE_EMPHASIS_VALUES).optional(),
});

/** Top-level response shape we expect back from the LLM. */
export const GenerationResponseSchema = z.object({
  cues: z.array(AssignmentSchema).min(1).max(360),
  rationale: z.string().optional(),
});

export type Assignment = z.infer<typeof AssignmentSchema>;

/** Discriminated result returned by {@link ../runner.server.generateCuesForShow}. */
export type GenerateCuesResult =
  | { ok: true; cueCount: number; showId?: string; userId?: string }
  | {
      ok: true;
      pending: true;
      reason:
        | 'music_analysis_running'
        | 'generation_already_claimed'
        | 'cue_generation_retry_scheduled'
        | 'no_generation_ready';
      showId?: string;
      userId?: string;
    }
  | { ok: false; error: string };

/** Subset of `shows` columns the cue generator needs. */
export type ShowBriefRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  duration_seconds: number | null;
  budget_cents: number | null;
  time_of_day: string | null;
  location: string | null;
  mood_tags: string[] | null;
  music_analysis_id: string | null;
  show_style: string | null;
  site_width_feet: number | null;
  selected_cue_model: string | null;
  firework_types: string[] | null;
};
