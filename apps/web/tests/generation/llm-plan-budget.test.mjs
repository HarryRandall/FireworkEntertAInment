/**
 * Behaviour of the bounded model plan request: request options, the single
 * transient retry, the overall time budget and the deterministic fallback.
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';

await import('../../../../scripts/renderer/register-typescript.mjs');
const root = process.cwd();

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only') {
      return { url: 'data:text/javascript,export {};', shortCircuit: true };
    }
    // Stands in for a deployment without OPENROUTER_API_KEY: client construction throws.
    if (specifier === '@/lib/openrouter.server') {
      return {
        url: 'data:text/javascript,export function getOpenRouterClient() { throw new Error("OPENROUTER_API_KEY is not configured"); }',
        shortCircuit: true,
      };
    }
    let unresolvedPath = null;
    if (specifier.startsWith('@/')) {
      unresolvedPath = join(root, specifier.slice(2));
    } else if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
      unresolvedPath = join(dirname(fileURLToPath(context.parentURL)), specifier);
    }
    if (unresolvedPath) {
      for (const candidate of [
        unresolvedPath,
        `${unresolvedPath}.ts`,
        join(unresolvedPath, 'index.ts'),
      ]) {
        if (existsSync(candidate)) return nextResolve(pathToFileURL(candidate).href, context);
      }
    }
    return nextResolve(specifier, context);
  },
});

// Imports stay dynamic so the resolve hook above is registered first. Each one
// destructures its bindings directly so Knip can see which exports tests use.
const {
  requestShowPlan,
  isRetryableModelFailure,
  LLM_PLAN_TIMEOUT_MS,
  LLM_PLAN_TOTAL_BUDGET_MS,
  LLM_PLAN_MIN_RETRY_WINDOW_MS,
} = await import('../../lib/cue-generation/llm-plan.server.ts');
const { buildPlanSections, describeCataloguePalette, buildDefaultShowPlan } =
  await import('../../lib/cue-generation/show-plan.ts');
const { parseCreativeDirection } = await import('../../lib/cue-generation/creative-direction.ts');
const { parsePromptConstraints } = await import('../../lib/cue-generation/prompt-constraints.ts');
const { effectTemplates } = await import('@showcrafter/renderer');
const { DEFAULT_FIREWORK_SPEC } = await import('@showcrafter/fireworks/spec');

const DEFAULT_DESIGN = effectTemplates.find((entry) => entry.key === 'peony').design;

const songDuration = 120;
const products = ['red', 'green', 'gold'].map((colour, index) => ({
  id: `${colour}-shell`,
  slug: `${colour}-shell`,
  name: `${colour} shell`,
  description: 'Aerial shell',
  sortOrder: index,
  durationSeconds: 1.6,
  occupancyDurationSeconds: 1.6,
  minPriceCents: 1000,
  heightMeters: 40,
  caliber: '75mm',
  shotCount: 1,
  manufacturer: 'Test',
  previewImagePath: null,
  previewImageRevision: null,
  spec: {
    ...DEFAULT_FIREWORK_SPEC,
    color: { red: '#e63946', green: '#2a9d8f', gold: '#ffd166' }[colour],
  },
  rawSpec: null,
  renderDesign: null,
  design: DEFAULT_DESIGN,
  kind: DEFAULT_DESIGN.kind,
  baseEffect: null,
  variant: null,
}));
const sections = buildPlanSections(null, songDuration);
const palette = describeCataloguePalette(products);
const constraints = parsePromptConstraints('');
const fallback = buildDefaultShowPlan({
  sections,
  direction: parseCreativeDirection('', 'signature'),
  constraints,
  palette,
});

function params() {
  return {
    model: 'vendor/test-model',
    userPrompt: 'Bright and joyful',
    brief: { title: 'Test show' },
    analysis: null,
    songDuration,
    sections,
    fallback,
    palette,
    products,
    constraints,
    showStyle: 'signature',
    promptConfig: null,
    productCatalogueFields: ['name', 'colour'],
  };
}

/** Fake chat client whose attempts are scripted; `clock` advances per attempt. */
function scriptedClient(script, clock) {
  const calls = [];
  return {
    calls,
    chat: {
      completions: {
        create: async (body, options) => {
          const step = script[calls.length] ?? script[script.length - 1];
          calls.push({ body, options });
          clock.now += step.elapsedMs ?? 0;
          if (step.error) throw step.error;
          return {
            choices: [
              { message: { content: step.content }, finish_reason: step.finishReason ?? 'stop' },
            ],
          };
        },
      },
    },
  };
}

function withStatus(status, message = `status ${status}`) {
  return Object.assign(new Error(message), { status });
}

const validReply = JSON.stringify({
  narrative: 'Open gently, build to a bright finale.',
  sections: sections.map((section, index) => ({
    s: section.index,
    role: index === sections.length - 1 ? 'finale' : 'build',
    density: 2,
    palette: ['red'],
  })),
});

test('a successful reply is requested with bounded options and no SDK retries', async () => {
  const clock = { now: 0 };
  const client = scriptedClient([{ content: validReply, elapsedMs: 4_000 }], clock);
  const outcome = await requestShowPlan(params(), { client, now: () => clock.now });

  assert.equal(client.calls.length, 1);
  const { body, options } = client.calls[0];
  assert.equal(options.maxRetries, 0);
  assert.equal(options.timeout, LLM_PLAN_TIMEOUT_MS);
  assert.equal(body.model, 'vendor/test-model');
  assert.equal(body.max_tokens, 4000);
  assert.deepEqual(body.response_format, { type: 'json_object' });
  assert.equal(body.temperature, 0.5, 'creativity settings are unchanged');
  assert.equal(outcome.failure, null);
  assert.equal(outcome.plan.source, 'llm');
  assert.equal(outcome.attempts, 1);
  assert.equal(outcome.durationMs, 4_000);
  assert.ok(outcome.responseBytes > 0);
});

test('a quick transient provider failure earns exactly one retry within the budget', async () => {
  const clock = { now: 0 };
  const client = scriptedClient(
    [
      { error: withStatus(429, 'rate limited'), elapsedMs: 2_000 },
      { content: validReply, elapsedMs: 5_000 },
    ],
    clock,
  );
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args);
  try {
    const outcome = await requestShowPlan(params(), { client, now: () => clock.now });
    assert.equal(client.calls.length, 2);
    assert.equal(outcome.attempts, 2);
    assert.equal(outcome.failure, null);
    assert.equal(outcome.plan.source, 'llm');
    // The second attempt cannot run past the overall budget.
    assert.equal(
      client.calls[1].options.timeout,
      Math.min(LLM_PLAN_TIMEOUT_MS, LLM_PLAN_TOTAL_BUDGET_MS - 2_000),
    );
    assert.equal(client.calls[1].options.maxRetries, 0);
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0][1].attempt, 1);
  } finally {
    console.warn = originalWarn;
  }
});

test('a timeout that used most of the budget falls back instead of stacking a second wait', async () => {
  const clock = { now: 0 };
  const timeoutError = Object.assign(new Error('Request timed out.'), {
    name: 'APIConnectionTimeoutError',
  });
  const client = scriptedClient([{ error: timeoutError, elapsedMs: LLM_PLAN_TIMEOUT_MS }], clock);
  const outcome = await requestShowPlan(params(), { client, now: () => clock.now });

  assert.equal(client.calls.length, 1, 'no retry: fewer than the minimum window remained');
  assert.ok(LLM_PLAN_TOTAL_BUDGET_MS - LLM_PLAN_TIMEOUT_MS < LLM_PLAN_MIN_RETRY_WINDOW_MS);
  assert.equal(outcome.attempts, 1);
  assert.match(outcome.failure, /Request timed out/);
  assert.equal(outcome.plan, fallback, 'the deterministic plan is used verbatim');
  assert.equal(outcome.durationMs, LLM_PLAN_TIMEOUT_MS);
});

test('non-transient provider errors and second failures fall back without further requests', async (context) => {
  context.mock.method(console, 'warn', () => {});
  const clock = { now: 0 };
  const badRequest = scriptedClient(
    [{ error: withStatus(400, 'bad request'), elapsedMs: 1_000 }],
    clock,
  );
  const first = await requestShowPlan(params(), { client: badRequest, now: () => clock.now });
  assert.equal(badRequest.calls.length, 1);
  assert.equal(first.plan, fallback);
  assert.match(first.failure, /bad request/);

  const twice = scriptedClient(
    [
      { error: withStatus(503, 'upstream unavailable'), elapsedMs: 1_000 },
      { error: withStatus(502, 'bad gateway'), elapsedMs: 1_000 },
      { content: validReply },
    ],
    { now: 0 },
  );
  const second = await requestShowPlan(params(), { client: twice, now: () => 0 });
  assert.equal(twice.calls.length, 2, 'at most two attempts are ever made');
  assert.equal(second.attempts, 2);
  assert.match(second.failure, /bad gateway \(after 2 attempts\)/);
  assert.equal(second.plan, fallback);
});

test('a missing provider configuration falls back without sending any request', async () => {
  const clock = { now: 0 };
  const outcome = await requestShowPlan(params(), { now: () => clock.now });
  assert.equal(outcome.attempts, 0, 'no request was attempted');
  assert.equal(outcome.plan, fallback);
  assert.match(outcome.failure, /OPENROUTER_API_KEY is not configured/);
  assert.ok(outcome.promptBytes > 0, 'the prompt is still measured for the report');
  assert.equal(outcome.responseBytes, 0);
});

test('truncated or unparseable replies fall back after a single attempt', async () => {
  const cutOff = scriptedClient([{ content: '{"sections": [', finishReason: 'length' }], {
    now: 0,
  });
  const truncated = await requestShowPlan(params(), { client: cutOff, now: () => 0 });
  assert.equal(cutOff.calls.length, 1);
  assert.match(truncated.failure, /cut off at the output limit/);
  assert.equal(truncated.plan, fallback);

  const garbage = scriptedClient([{ content: 'not json' }], { now: 0 });
  const parsed = await requestShowPlan(params(), { client: garbage, now: () => 0 });
  assert.equal(garbage.calls.length, 1);
  assert.match(parsed.failure, /could not parse model plan/);
  assert.equal(parsed.plan, fallback);
});

test('retry classification mirrors the SDK policy', () => {
  for (const status of [408, 409, 429, 500, 502, 503]) {
    assert.equal(isRetryableModelFailure(withStatus(status)), true, String(status));
  }
  for (const status of [400, 401, 403, 404, 422]) {
    assert.equal(isRetryableModelFailure(withStatus(status)), false, String(status));
  }
  assert.equal(
    isRetryableModelFailure(Object.assign(new Error(), { name: 'APIConnectionError' })),
    true,
  );
  assert.equal(isRetryableModelFailure(new Error('plain')), false);
  assert.equal(isRetryableModelFailure(null), false);
});
