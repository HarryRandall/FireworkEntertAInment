import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { registerHooks, createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { test, beforeEach } from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const appRoot = fileURLToPath(new URL('../../', import.meta.url));
const mocks = {
  '@/lib/access/current-profile.server':
    'export async function requirePermission(permission) { globalThis.manualRecovery.calls.push(permission); return globalThis.manualRecovery.admin; }',
  '@/lib/supabase/service-role':
    'export function createServiceRoleSupabase() { globalThis.manualRecovery.calls.push("service-role"); return globalThis.manualRecovery.database; }',
  '@/lib/show-analysis-runner.server':
    'export async function runMusicAnalysisForUpload() { globalThis.manualRecovery.calls.push("analysis"); return globalThis.manualRecovery.analysis; }',
  '@/lib/cue-generation/runner.server':
    'export async function generateCuesForShow() { globalThis.manualRecovery.calls.push("cues"); return globalThis.manualRecovery.cues; }',
  '@/lib/music-analysis-lifecycle.server':
    'export async function markLinkedShowGenerationFailed(params) { globalThis.manualRecovery.calls.push(params); }',
};
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'next/server') specifier = 'next/server.js';
    if (specifier === 'server-only')
      return { url: 'data:text/javascript,export {};', shortCircuit: true };
    if (mocks[specifier])
      return {
        url: `data:text/javascript,${encodeURIComponent(mocks[specifier])}`,
        shortCircuit: true,
      };
    if (specifier.startsWith('@/'))
      specifier = pathToFileURL(resolve(appRoot, specifier.slice(2))).href;
    if (specifier.startsWith('file:') && !existsSync(new URL(specifier))) specifier += '.ts';
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith('.ts'))
      return {
        format: 'module',
        shortCircuit: true,
        source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
          compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
        }).outputText,
      };
    return next(url, context);
  },
});
const { POST } = await import('../../app/api/admin/analyser/reconcile/route.ts');
const { recoverMusicAnalysisWork } = await import('../../lib/music-analysis-recovery.server.ts');
beforeEach(() => {
  process.env.ANALYSER_DISPATCH_URL = 'https://analyser.example/runs';
  globalThis.manualRecovery = {
    calls: [],
    admin: { id: 'admin' },
    analysis: { ok: false, pending: true, idle: true },
    cues: { ok: true, pending: true, reason: 'no_generation_ready' },
    database: {
      async rpc(name, input) {
        globalThis.manualRecovery.calls.push({ name, input });
        return { data: [], error: null };
      },
    },
  };
});

test('manual recovery denies users without the permission before privileged work', async () => {
  globalThis.manualRecovery.admin = null;
  const response = await POST();
  assert.equal(response.status, 403);
  assert.deepEqual(globalThis.manualRecovery.calls, ['admin.manage_imports']);
});

test('manual recovery requires queue configuration before touching jobs', async () => {
  delete process.env.ANALYSER_DISPATCH_URL;
  assert.equal((await POST()).status, 503);
  assert.deepEqual(globalThis.manualRecovery.calls, ['admin.manage_imports']);
});

test('an idle click runs one bounded pass without retention or audio deletion', async () => {
  const response = await POST();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    expiredAnalyses: 0,
    expiredCues: 0,
    analysis: 'idle',
    cues: 'idle',
  });
  assert.deepEqual(globalThis.manualRecovery.calls, [
    'admin.manage_imports',
    'service-role',
    { name: 'expire_exhausted_song_analyses', input: { p_limit: 10, p_max_attempts: 3 } },
    { name: 'expire_exhausted_cue_generations', input: { p_limit: 10, p_max_attempts: 3 } },
    'analysis',
    'cues',
  ]);
});

test('recovery reports queued analysis and completed cues without repeating', async () => {
  globalThis.manualRecovery.analysis = { ok: false, pending: true };
  globalThis.manualRecovery.cues = { ok: true };
  const result = await recoverMusicAnalysisWork(globalThis.manualRecovery.database);
  assert.equal(result.analysis, 'pending');
  assert.equal(result.cues, 'completed');
  assert.equal(globalThis.manualRecovery.calls.filter((call) => call === 'analysis').length, 1);
  assert.equal(globalThis.manualRecovery.calls.filter((call) => call === 'cues').length, 1);
});

test('exhausted analysis fails linked shows and preserves expiry counts', async () => {
  globalThis.manualRecovery.database.rpc = async (name) => ({
    data:
      name === 'expire_exhausted_song_analyses'
        ? [{ user_id: 'owner', analysis_id: 'analysis', error_message: 'Exhausted' }]
        : [],
    error: null,
  });
  const result = await recoverMusicAnalysisWork(globalThis.manualRecovery.database);
  assert.equal(result.expiredAnalyses, 1);
  assert.ok(
    globalThis.manualRecovery.calls.some(
      (call) => call.musicAnalysisId === 'analysis' && call.error === 'Exhausted',
    ),
  );
});

test('persistence failure is reported instead of claiming successful recovery', async () => {
  globalThis.manualRecovery.database.rpc = async () => ({
    data: null,
    error: { message: 'Unavailable' },
  });
  const response = await POST();
  assert.equal(response.status, 500);
  assert.equal((await response.json()).ok, false);
  assert.ok(!globalThis.manualRecovery.calls.includes('analysis'));
});

test('terminal analysis failure propagates to linked shows and reports a failed pass', async () => {
  globalThis.manualRecovery.analysis = {
    ok: false,
    userId: 'owner',
    analysisId: 'analysis',
    error: 'Invalid audio',
  };
  const response = await POST();
  assert.equal(response.status, 500);
  assert.equal((await response.json()).analysis, 'failed');
  assert.ok(
    globalThis.manualRecovery.calls.some(
      (call) => call.musicAnalysisId === 'analysis' && call.error === 'Invalid audio',
    ),
  );
});
