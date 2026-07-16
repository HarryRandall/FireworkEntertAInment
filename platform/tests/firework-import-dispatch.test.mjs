import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { join } from 'node:path';
import { test } from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only') {
      return nextResolve('data:text/javascript,export {};', context);
    }
    return nextResolve(specifier, context);
  },
});

const { dispatchFireworkImportRun, getFireworkImportDispatchConfiguration } =
  await import('../lib/firework-import-trigger.server.ts');

const root = process.cwd();
const runId = '019f6471-87ef-7dc1-a23b-9cf086945402';
const productionEnvironment = {
  NODE_ENV: 'production',
  FIREWORK_IMPORT_URL: 'https://workspace--showcrafter-firework-import-api.modal.run',
  FIREWORK_IMPORT_SHARED_SECRET: 's'.repeat(32),
};

test('production dispatch configuration fails closed while development keeps its local worker', () => {
  assert.deepEqual(getFireworkImportDispatchConfiguration({ NODE_ENV: 'development' }), {
    mode: 'local-worker',
  });
  assert.equal(getFireworkImportDispatchConfiguration({ NODE_ENV: 'production' }).mode, 'invalid');
  assert.equal(
    getFireworkImportDispatchConfiguration({
      ...productionEnvironment,
      FIREWORK_IMPORT_SHARED_SECRET: 'too-short',
    }).mode,
    'invalid',
  );
  assert.equal(
    getFireworkImportDispatchConfiguration({
      ...productionEnvironment,
      FIREWORK_IMPORT_URL: 'https://example.test/dispatch?secret=unsafe',
      FIREWORK_IMPORT_ALLOWED_HOSTS: 'example.test',
    }).mode,
    'invalid',
  );

  const direct = getFireworkImportDispatchConfiguration(productionEnvironment);
  assert.equal(direct.mode, 'direct');
  assert.equal(direct.dispatchUrl.toString(), `${productionEnvironment.FIREWORK_IMPORT_URL}/runs`);
});

test('direct dispatch retries transient failures and accepts only the exact 202 contract', async () => {
  const requests = [];
  const waits = [];
  const responses = [
    new Response('', { status: 503 }),
    new TypeError('temporary network failure'),
    new Response(JSON.stringify({ runId, status: 'accepted', callId: 'fc-accepted-123' }), {
      status: 202,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    }),
  ];

  const result = await dispatchFireworkImportRun(runId, {
    environment: productionEnvironment,
    fetchImpl: async (url, init) => {
      requests.push({ url: String(url), init });
      const response = responses.shift();
      if (response instanceof Error) throw response;
      return response;
    },
    wait: async (delayMs) => {
      waits.push(delayMs);
    },
  });

  assert.deepEqual(result, { dispatched: true, callId: 'fc-accepted-123', attempts: 3 });
  assert.deepEqual(waits, [250, 500]);
  assert.equal(requests.length, 3);
  for (const request of requests) {
    assert.equal(request.url, `${productionEnvironment.FIREWORK_IMPORT_URL}/runs`);
    assert.equal(request.init.method, 'POST');
    assert.equal(request.init.cache, 'no-store');
    assert.equal(request.init.headers.Authorization, `Bearer ${'s'.repeat(32)}`);
    assert.deepEqual(JSON.parse(request.init.body), { runId });
  }
});

test('non-202 and mismatched acknowledgements fail without unsafe retries', async () => {
  let requestCount = 0;
  const unexpectedSuccess = await dispatchFireworkImportRun(runId, {
    environment: productionEnvironment,
    fetchImpl: async () => {
      requestCount += 1;
      return new Response(JSON.stringify({ runId, status: 'accepted', callId: 'fc-200' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
    wait: async () => undefined,
  });
  assert.equal(unexpectedSuccess.dispatched, false);
  assert.equal(unexpectedSuccess.attempts, 1);
  assert.equal(requestCount, 1);

  requestCount = 0;
  const mismatched = await dispatchFireworkImportRun(runId, {
    environment: productionEnvironment,
    fetchImpl: async () => {
      requestCount += 1;
      return new Response(
        JSON.stringify({
          runId: '019f6471-87ef-7dc1-a23b-9cf086945499',
          status: 'accepted',
          callId: 'fc-wrong-run',
        }),
        { status: 202, headers: { 'Content-Type': 'application/json' } },
      );
    },
    wait: async () => undefined,
  });
  assert.equal(mismatched.dispatched, false);
  assert.equal(mismatched.attempts, 1);
  assert.equal(requestCount, 1);
});

test('production queue actions preflight before funding and persist dispatch results', () => {
  const actions = readFileSync(join(root, 'app/actions/platform-admin.ts'), 'utf8');
  const baseMigration = readFileSync(
    join(root, 'supabase/migrations/20260715064431_add_firework_import_reconstruction_runs.sql'),
    'utf8',
  );
  const dispatchMigration = readFileSync(
    join(
      root,
      'supabase/migrations/20260715224838_add_firework_import_direct_dispatch_hardening.sql',
    ),
    'utf8',
  );
  const historyServer = readFileSync(join(root, 'lib/import-review.server.ts'), 'utf8');
  const historyUi = readFileSync(
    join(root, 'app/(admin)/admin/imports/[id]/ImportRunHistory.tsx'),
    'utf8',
  );

  for (const [actionName, rpcName] of [
    ['finalizeVideoImportJobAction', 'finalise_firework_video_import'],
    ['queueImportJobAction', 'start_firework_import_run'],
    ['requestImportRefinementAction', 'start_firework_import_run'],
  ]) {
    const start = actions.indexOf(`export async function ${actionName}`);
    const nextAction = actions.indexOf('\nexport async function ', start + 1);
    const source = actions.slice(start, nextAction < 0 ? actions.length : nextAction);
    assert.ok(source.indexOf('prepareFireworkImportDispatch()') < source.indexOf(`'${rpcName}'`));
    assert.match(source, /scheduleFireworkImportDispatch/);
  }

  assert.match(actions, /check_firework_import_dispatch_ready/);
  assert.match(actions, /begin_firework_import_dispatch/);
  assert.match(actions, /record_firework_import_dispatch_result/);
  assert.doesNotMatch(baseMigration, /direct_dispatch/);
  assert.match(dispatchMigration, /direct_dispatch_status/);
  assert.match(dispatchMigration, /perform private\.resolve_firework_import_credit/);
  assert.match(dispatchMigration, /run_row\.status = 'queued'/);
  assert.match(dispatchMigration, /return 'worker_claimed'/);
  assert.match(historyServer, /direct_dispatch_call_id/);
  assert.match(historyUi, /Queued dispatch health/);
  assert.match(historyUi, /Executor provenance is recorded separately/);
});
