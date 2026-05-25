import 'server-only';

import OpenAI from 'openai';

export const DEFAULT_CUE_MODEL = process.env.OPENROUTER_CUE_MODEL ?? 'anthropic/claude-sonnet-4.5';

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
