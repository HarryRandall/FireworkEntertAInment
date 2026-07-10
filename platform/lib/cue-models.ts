export const FALLBACK_CUE_MODEL = 'openai/gpt-4.1-mini';

export const CUE_MODEL_OPTIONS = [
  {
    value: FALLBACK_CUE_MODEL,
    label: 'GPT-4.1 Mini',
    description: 'Faster lower-cost option.',
    provider: 'openai',
    creditCost: 1,
  },
  {
    value: 'openai/gpt-4.1',
    label: 'GPT-4.1',
    description: 'Detailed OpenAI option.',
    provider: 'openai',
    creditCost: 1,
  },
  {
    value: 'google/gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    description: 'Fast Google option.',
    provider: 'google',
    creditCost: 1,
  },
  {
    value: 'anthropic/claude-sonnet-4.5',
    label: 'Claude Sonnet 4.5',
    description: 'Rich choreography option.',
    provider: 'anthropic',
    creditCost: 3,
  },
  {
    value: 'anthropic/claude-opus-4.1',
    label: 'Claude Opus 4.1',
    description: 'Highest reasoning option.',
    provider: 'anthropic',
    creditCost: 5,
  },
] as const;

export type CueModel = (typeof CUE_MODEL_OPTIONS)[number]['value'];

export function isCueModel(value: string): value is CueModel {
  return CUE_MODEL_OPTIONS.some((option) => option.value === value);
}

export function normaliseCueModel(value: unknown, fallback = FALLBACK_CUE_MODEL): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return isCueModel(trimmed) ? trimmed : fallback;
}

/**
 * Preserve a model identifier that has already crossed a trusted server or
 * database boundary. Persisted configured models are intentionally not
 * limited to the choices currently shown in the wizard because deployments
 * must not change the model attached to an in-flight generation run.
 */
export function normalisePersistedCueModel(value: unknown, fallback = FALLBACK_CUE_MODEL): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 120) return fallback;
  return /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._:@/-]*$/i.test(trimmed) ? trimmed : fallback;
}
