/**
 * Ask the selected model for a section-level show plan.
 *
 * The reply is small (one entry per section), so it fits comfortably inside
 * the output budget and the timeout. Any failure returns the deterministic
 * plan with a reason; generation never switches planner because of the model.
 *
 * The wait is bounded as a whole: one attempt may take up to
 * {@link LLM_PLAN_TIMEOUT_MS}, and a second attempt only follows a transient
 * provider failure when enough of {@link LLM_PLAN_TOTAL_BUDGET_MS} remains.
 * The SDK's own retries are disabled so a slow model cannot stack timeouts.
 */
import 'server-only';

import type OpenAI from 'openai';
import { getOpenRouterClient } from '@/lib/openrouter.server';
import type { ProductCatalogueField } from '@/lib/prompt-configs';
import type { FireworkSpecification } from '@/lib/show-domain';
import type { AnalyserResult } from '@/lib/show-analysis.types';
import { extractProviderError, stripJsonFence } from './llm';
import { buildPlanPayload, buildSystemPrompt, productAliases } from './prompt';
import type { PromptConstraints } from './prompt-constraints';
import {
  LlmShowPlanSchema,
  resolveShowPlan,
  type CataloguePalette,
  type PlanSection,
  type ShowPlan,
} from './show-plan';
import type { ShowStyleKey } from './show-styles';

/** Longest a single model request may run. */
export const LLM_PLAN_TIMEOUT_MS = 75_000;
/** Longest the whole plan request may run, including one retry. */
export const LLM_PLAN_TOTAL_BUDGET_MS = 90_000;
/** A retry is pointless unless the model has at least this long to answer. */
export const LLM_PLAN_MIN_RETRY_WINDOW_MS = 20_000;
const LLM_PLAN_MAX_ATTEMPTS = 2;
const LLM_PLAN_MAX_TOKENS = 4000;

export type LlmPlanOutcome = {
  plan: ShowPlan;
  /** Why the default plan was used instead, or null when the model's plan was accepted. */
  failure: string | null;
  promptBytes: number;
  responseBytes: number;
  durationMs: number;
  /** Model requests actually sent, for the generation report. */
  attempts: number;
};

/** The slice of the OpenAI client this module calls, so tests can inject a fake. */
type ShowPlanModelClient = {
  chat: {
    completions: {
      create: (
        body: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
        options?: { timeout?: number; maxRetries?: number; signal?: AbortSignal },
      ) => Promise<Pick<OpenAI.Chat.Completions.ChatCompletion, 'choices'>>;
    };
  };
};

export type RequestShowPlanDependencies = {
  client?: ShowPlanModelClient;
  /** Monotonic clock in milliseconds; defaults to `performance.now`. */
  now?: () => number;
};

/**
 * Mirrors the SDK's retry classification (connection failures, 408/409/429
 * and 5xx) without relying on its private error classes, so the policy can be
 * exercised with plain objects.
 */
export function isRetryableModelFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { status, name } = error as { status?: unknown; name?: unknown };
  if (typeof status === 'number') {
    return status === 408 || status === 409 || status === 429 || status >= 500;
  }
  return name === 'APIConnectionError' || name === 'APIConnectionTimeoutError';
}

export async function requestShowPlan(
  params: {
    model: string;
    userPrompt: string;
    brief: Record<string, unknown>;
    analysis: AnalyserResult | null;
    songDuration: number;
    sections: PlanSection[];
    fallback: ShowPlan;
    palette: CataloguePalette;
    products: FireworkSpecification[];
    constraints: PromptConstraints;
    showStyle: ShowStyleKey | null;
    promptConfig: { systemPromptText?: string | null; productContextText?: string | null } | null;
    productCatalogueFields: readonly ProductCatalogueField[];
  },
  dependencies: RequestShowPlanDependencies = {},
): Promise<LlmPlanOutcome> {
  const now = dependencies.now ?? (() => performance.now());
  const started = now();
  const { aliasById, idByAlias, shown } = productAliases(params.products);
  const { prompt: systemPrompt, ignoredLegacyPrompt } = buildSystemPrompt({
    systemPromptText: params.promptConfig?.systemPromptText,
    productContextText: params.promptConfig?.productContextText,
    productCatalogueFields: params.productCatalogueFields,
    showStyle: params.showStyle,
  });
  if (ignoredLegacyPrompt) {
    console.warn(
      '[cue-generation] saved show prompt targets the retired per-slot contract; using the default guidance.',
    );
  }
  const userContent = JSON.stringify(
    buildPlanPayload({
      userPrompt: params.userPrompt,
      brief: params.brief,
      analysis: params.analysis,
      songDuration: params.songDuration,
      sections: params.sections,
      fallback: params.fallback,
      palette: params.palette,
      products: shown,
      aliasById,
      productCatalogueFields: params.productCatalogueFields,
    }),
  );
  const promptBytes = byteLength(systemPrompt) + byteLength(userContent);
  let attempts = 0;
  const outcome = (failure: string | null, plan: ShowPlan, responseBytes = 0): LlmPlanOutcome => ({
    plan,
    failure,
    promptBytes,
    responseBytes,
    durationMs: Math.round(now() - started),
    attempts,
  });

  // A missing or invalid provider configuration is a plan failure like any
  // other: the deterministic plan is used and the reason is recorded, without
  // sending a request.
  let client: ShowPlanModelClient;
  try {
    client = dependencies.client ?? getOpenRouterClient();
  } catch (error) {
    return outcome(error instanceof Error ? error.message : String(error), params.fallback);
  }
  const body: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
    model: params.model,
    temperature: 0.5,
    max_tokens: LLM_PLAN_MAX_TOKENS,
    // `json_object` is the widely supported structured-output mode on OpenRouter.
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
  };

  let raw: string;
  for (;;) {
    const remainingMs = LLM_PLAN_TOTAL_BUDGET_MS - (now() - started);
    attempts += 1;
    try {
      const completion = await client.chat.completions.create(body, {
        timeout: Math.max(1, Math.min(LLM_PLAN_TIMEOUT_MS, Math.round(remainingMs))),
        maxRetries: 0,
      });
      const choice = completion.choices[0];
      raw = choice?.message?.content ?? '';
      if (choice?.finish_reason === 'length') {
        return outcome(
          'model reply was cut off at the output limit',
          params.fallback,
          byteLength(raw),
        );
      }
      if (!raw) return outcome('model returned an empty reply', params.fallback);
      break;
    } catch (error) {
      const detail = extractProviderError(error);
      const message = error instanceof Error ? error.message : String(error);
      const failure = detail ? `${message} - ${detail}` : message;
      const retryWindowMs = LLM_PLAN_TOTAL_BUDGET_MS - (now() - started);
      if (
        attempts >= LLM_PLAN_MAX_ATTEMPTS ||
        !isRetryableModelFailure(error) ||
        retryWindowMs < LLM_PLAN_MIN_RETRY_WINDOW_MS
      ) {
        return outcome(
          attempts > 1 ? `${failure} (after ${attempts} attempts)` : failure,
          params.fallback,
        );
      }
      console.warn('[cue-generation] retrying model plan request after transient failure:', {
        model: params.model,
        attempt: attempts,
        error: failure,
      });
    }
  }

  try {
    const parsed = LlmShowPlanSchema.parse(JSON.parse(stripJsonFence(raw)));
    const plan = resolveShowPlan({
      llmPlan: parsed,
      fallback: params.fallback,
      aliases: idByAlias,
      palette: params.palette,
      constraints: params.constraints,
    });
    return outcome(null, plan, byteLength(raw));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return outcome(`could not parse model plan: ${message}`, params.fallback, byteLength(raw));
  }
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}
