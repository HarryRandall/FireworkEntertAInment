/**
 * Shared constants for the admin video import flow.
 *
 * - Storage bucket names and limits (e.g. {@link IMPORT_VIDEO_BUCKET})
 * - The OpenRouter model dropdown options used in the admin UI
 *
 * Imported by both admin import actions and server modules
 * (`lib/admin/imports.server.ts`).
 */
export const IMPORT_VIDEO_BUCKET = 'import-videos';
export const MAX_IMPORT_VIDEO_SECONDS = 60;

export const OPENROUTER_MODEL_OPTIONS = [
  {
    value: 'openai/gpt-5.4',
    label: 'OpenAI GPT-5.4',
    description: 'Highest-detail structured reconstruction and critic passes.',
  },
  {
    value: 'openai/gpt-5.4-mini',
    label: 'GPT-5.4 Mini',
    description: 'Faster, lower-cost option for iteration and refinement.',
  },
  {
    value: 'google/gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    description: 'Alternative vision model for difficult source footage.',
  },
] as const;

export const DEFAULT_OPENROUTER_MODEL = OPENROUTER_MODEL_OPTIONS[0].value;
