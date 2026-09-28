/** Shared types for cue generation. The model's plan schema lives in `show-plan.ts`. */

/** Per-cue render emphasis. */
export const CUE_EMPHASIS_VALUES = ['normal', 'accent', 'peak'] as const;
export type CueEmphasis = (typeof CUE_EMPHASIS_VALUES)[number];

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
  assortment_id: string | null;
  creation_source: string;
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
