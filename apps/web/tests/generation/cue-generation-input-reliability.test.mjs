/**
 * The runner's input stage: catalogue read failures are retried rather than
 * refunded as "no products", an empty catalogue is still terminal, a running
 * analysis still wins over a broken catalogue, and the independent reads
 * overlap instead of running one after another.
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { beforeEach, test } from 'node:test';

await import('../../../../scripts/renderer/register-typescript.mjs');
const root = process.cwd();

const STUBS = {
  'server-only': 'export {};',
  'next/cache': 'export function revalidatePath() {}',
  '@/lib/server-cache': `
    export async function getCachedJson() { return null; }
    export async function setCachedJson() {}
    export async function deleteCachedKeys() {}
  `,
  '@/lib/supabase/service-role': 'export function createServiceRoleSupabase() { return null; }',
  '@/lib/openrouter.server': `
    export const DEFAULT_CUE_MODEL = 'openai/gpt-4.1-mini';
    export function getOpenRouterClient() { throw new Error('model client requested'); }
  `,
  '@/lib/prompt-configs.server': `
    export async function getShowCueGenerationSettings() { return { generationMode: 'fast', productCatalogueFields: ['name'] }; }
    export async function getActivePromptConfig() { return null; }
  `,
  '@/lib/shows/mutations.server': 'export async function syncShowDerivedFieldsForUser() {}',
  '@/lib/shows/queries.server': `
    export async function listFireworkProducts() {
      const scenario = globalThis.runnerTest;
      scenario.log.push('catalogue:start');
      await new Promise((resolve) => setTimeout(resolve, scenario.catalogueDelayMs ?? 0));
      scenario.log.push('catalogue:end');
      if (scenario.catalogueError) throw scenario.catalogueError;
      return scenario.products;
    }
    export async function fetchShotsByCatalogueItem() { return new Map(); }
  `,
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier in STUBS) {
      return {
        url: `data:text/javascript,${encodeURIComponent(STUBS[specifier])}`,
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

const [{ generateCuesForShow }, { CatalogueReadError, ShowsNetworkError }] = await Promise.all([
  import('../../lib/cue-generation/runner.server.ts'),
  import('../../lib/shows/read-errors.ts'),
]);

const CLAIM = {
  show_id: 'show',
  user_id: 'owner',
  // Most scenarios run without a song so the catalogue is the first input that can fail.
  music_analysis_id: null,
  selected_cue_model: null,
  show_style: 'signature',
  credit_action_key: 'show_generation_fast',
  attempt_count: 1,
  lease_token: 'lease',
};

const BRIEF = {
  id: 'show',
  slug: 'winter-is-coming',
  title: 'Winter Is Coming',
  description: '',
  duration_seconds: 120,
  budget_cents: null,
  time_of_day: null,
  location: null,
  mood_tags: [],
  music_analysis_id: 'analysis',
  show_style: 'signature',
  site_width_feet: 80,
  selected_cue_model: null,
  firework_types: null,
  assortment_id: null,
  creation_source: 'wizard',
};

/** Table-aware fake: the brief, analysis and reservation rows plus recorded RPCs. */
function database({ analysisStatus = 'running', briefDelayMs = 0, claim = CLAIM } = {}) {
  const scenario = globalThis.runnerTest;
  const rows = {
    shows: BRIEF,
    song_analyses: { status: analysisStatus, analysis_json: null, error_message: null },
    ai_credit_transactions: { metadata: { durationMode: 'song' } },
  };
  return {
    from(table) {
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => {
          if (table === 'shows') {
            scenario.log.push('brief:start');
            await new Promise((resolve) => setTimeout(resolve, briefDelayMs));
            scenario.log.push('brief:end');
          }
          return { data: rows[table] ?? null, error: null };
        },
      };
      return builder;
    },
    async rpc(name, args) {
      scenario.rpcs.push({ name, args });
      if (name === 'claim_cue_generation_attempt') return { data: [claim], error: null };
      return { data: true, error: null };
    },
  };
}

beforeEach((context) => {
  context.mock.method(console, 'error', () => {});
  context.mock.method(console, 'info', () => {});
  globalThis.runnerTest = {
    log: [],
    rpcs: [],
    products: [],
    catalogueError: null,
    catalogueDelayMs: 0,
  };
});

test('a catalogue read failure schedules a retry instead of a refunded "no products" failure', async () => {
  globalThis.runnerTest.catalogueError = new CatalogueReadError({ code: '57014' });
  const result = await generateCuesForShow({
    supabase: database(),
    showId: 'show',
    userId: 'owner',
  });

  assert.deepEqual(result, {
    ok: true,
    pending: true,
    reason: 'cue_generation_retry_scheduled',
    showId: 'show',
    userId: 'owner',
  });
  const names = globalThis.runnerTest.rpcs.map((call) => call.name);
  assert.deepEqual(names, ['claim_cue_generation_attempt', 'schedule_cue_generation_retry']);
  const retry = globalThis.runnerTest.rpcs[1].args;
  assert.equal(retry.p_error_message, 'The firework catalogue could not be loaded.');
  assert.equal(retry.p_lease_token, 'lease');
  assert.equal(retry.p_retry_delay_seconds, 30);
  assert.ok(!names.includes('fail_cue_generation_attempt'), 'the reservation is not refunded yet');
});

test('a network failure on the catalogue read is retryable too', async () => {
  globalThis.runnerTest.catalogueError = new ShowsNetworkError(new Error('fetch failed'));
  const result = await generateCuesForShow({ supabase: database(), showId: 'show' });
  assert.equal(result.pending, true);
  assert.equal(result.reason, 'cue_generation_retry_scheduled');
});

test('an exhausted retry budget still fails and dead-letters with the safe message', async () => {
  globalThis.runnerTest.catalogueError = new CatalogueReadError({ code: '57014' });
  const supabase = database({ claim: { ...CLAIM, attempt_count: 3 } });
  const result = await generateCuesForShow({ supabase, showId: 'show' });
  assert.deepEqual(result, { ok: false, error: 'The firework catalogue could not be loaded.' });
  const fail = globalThis.runnerTest.rpcs.find(
    (call) => call.name === 'fail_cue_generation_attempt',
  );
  assert.ok(fail);
  assert.equal(fail.args.p_dead_letter, true);
  assert.equal(fail.args.p_error_message, 'The firework catalogue could not be loaded.');
});

test('a genuinely empty catalogue is a terminal failure, not a retry', async () => {
  globalThis.runnerTest.products = [];
  const result = await generateCuesForShow({ supabase: database(), showId: 'show' });
  assert.deepEqual(result, {
    ok: false,
    error: 'Product catalogue contains no firework products.',
  });
  const names = globalThis.runnerTest.rpcs.map((call) => call.name);
  assert.deepEqual(names, ['claim_cue_generation_attempt', 'fail_cue_generation_attempt']);
  assert.equal(globalThis.runnerTest.rpcs[1].args.p_dead_letter, false);
});

test('a running analysis reports as waiting even when the catalogue read fails', async () => {
  globalThis.runnerTest.catalogueError = new CatalogueReadError({ code: '57014' });
  const result = await generateCuesForShow({
    supabase: database({
      analysisStatus: 'running',
      claim: { ...CLAIM, music_analysis_id: 'analysis' },
    }),
    showId: 'show',
  });
  assert.deepEqual(result, { ok: true, pending: true, reason: 'music_analysis_running' });
  assert.deepEqual(
    globalThis.runnerTest.rpcs.map((call) => call.name),
    ['claim_cue_generation_attempt'],
    'no failure or retry is written while the analysis is still running',
  );
  // Let the swallowed catalogue rejection settle so it cannot surface later.
  await new Promise((resolve) => setTimeout(resolve, 5));
});

test('the catalogue read starts alongside the brief read instead of after it', async () => {
  globalThis.runnerTest.catalogueError = new CatalogueReadError({ code: '57014' });
  globalThis.runnerTest.catalogueDelayMs = 5;
  await generateCuesForShow({ supabase: database({ briefDelayMs: 20 }), showId: 'show' });
  const { log } = globalThis.runnerTest;
  assert.ok(log.indexOf('catalogue:start') < log.indexOf('brief:end'), log.join(' > '));
  assert.ok(log.indexOf('catalogue:end') < log.indexOf('brief:end'), log.join(' > '));
});
