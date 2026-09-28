/**
 * Ask the selected model for a section-level show plan.
 *
 * The reply is small (one entry per section), so it fits comfortably inside
 * the output budget and the timeout. Any failure returns the deterministic
 * plan with a reason; generation never switches planner because of the model.
 */
import 'server-only';

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

const LLM_PLAN_TIMEOUT_MS = 75_000;
const LLM_PLAN_MAX_TOKENS = 4000;

export type LlmPlanOutcome = {
  plan: ShowPlan;
  /** Why the default plan was used instead, or null when the model's plan was accepted. */
  failure: string | null;
  promptBytes: number;
  responseBytes: number;
  durationMs: number;
};

export async function requestShowPlan(params: {
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
}): Promise<LlmPlanOutcome> {
  const started = performance.now();
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
  const outcome = (failure: string | null, plan: ShowPlan, responseBytes = 0): LlmPlanOutcome => ({
    plan,
    failure,
    promptBytes,
    responseBytes,
    durationMs: Math.round(performance.now() - started),
  });

  let raw: string;
  try {
    const completion = await getOpenRouterClient().chat.completions.create(
      {
        model: params.model,
        temperature: 0.5,
        max_tokens: LLM_PLAN_MAX_TOKENS,
        // `json_object` is the widely supported structured-output mode on OpenRouter.
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
      },
      { timeout: LLM_PLAN_TIMEOUT_MS, maxRetries: 1 },
    );
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
  } catch (error) {
    const detail = extractProviderError(error);
    const message = error instanceof Error ? error.message : String(error);
    return outcome(detail ? `${message} - ${detail}` : message, params.fallback);
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
