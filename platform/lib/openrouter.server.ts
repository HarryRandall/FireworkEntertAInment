/**
 * Lazily-instantiated OpenRouter client (server-only).
 *
 * OpenRouter is OpenAI-compatible, so we reuse the official `openai` SDK with
 * a custom `baseURL` and the OpenRouter ranking headers. The client is
 * cached at module scope to avoid re-allocating per request.
 *
 * Throws on first use if `OPENROUTER_API_KEY` is missing — surface the error
 * to the caller rather than silently returning a broken client.
 */
import 'server-only';

import OpenAI from 'openai';
import { FALLBACK_CUE_MODEL, normalisePersistedCueModel } from '@/lib/cue-models';

export const DEFAULT_CUE_MODEL = normalisePersistedCueModel(
  process.env.OPENROUTER_CUE_MODEL,
  FALLBACK_CUE_MODEL,
);

let cached: OpenAI | null = null;

export function getOpenRouterClient(): OpenAI {
  if (cached) return cached;
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OPENROUTER_API_KEY is not set. Add it to platform/.env to enable cue generation.',
    );
  }
  cached = new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL ?? 'http://localhost:3000',
      'X-Title': process.env.OPENROUTER_APP_NAME ?? 'ShowCrafter',
    },
  });
  return cached;
}
