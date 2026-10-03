// Exercise the real loader against PostgREST responses without a running database.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
await import('../register-typescript.mjs');
const { loadTemplate } = await import('../../apps/web/lib/supabase/load-template.ts');
const { effectTemplates } = await import('../../packages/fireworks/src/templates/index.ts');
const requireWeb = createRequire(new URL('../../apps/web/package.json', import.meta.url));
const { createClient } = requireWeb('@supabase/supabase-js');

function clientFor(responses) {
  return createClient('http://127.0.0.1:55421', 'synthetic-test-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async () => {
        const response = responses.shift();
        assert.ok(response, 'unexpected extra database request');
        return new Response(JSON.stringify(response.body), {
          status: response.status ?? 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    },
  });
}
const effect = {
  name: 'Stored peony',
  family: 'Shells',
  current_version_id: '60000000-0000-4000-8000-000000000001',
};

test('template loader uses stored metadata and validates the current design', async () => {
  const design = effectTemplates[0].design;
  const client = clientFor([{ body: effect }, { body: { design, design_schema: 1 } }]);
  assert.deepEqual(await loadTemplate(client, 'peony'), {
    key: 'peony',
    name: effect.name,
    group: effect.family,
    design,
  });
});

test('template loader preserves read failures and rejects corrupt stored documents', async () => {
  await assert.rejects(
    loadTemplate(
      clientFor([{ status: 403, body: { message: 'Read denied', code: '42501' } }]),
      'peony',
    ),
    /Read denied/,
  );
  await assert.rejects(
    loadTemplate(clientFor([{ body: { ...effect, current_version_id: null } }]), 'peony'),
    /no current version/,
  );
  await assert.rejects(
    loadTemplate(
      clientFor([{ body: effect }, { status: 500, body: { message: 'Database unavailable' } }]),
      'peony',
    ),
    /Database unavailable/,
  );
  await assert.rejects(
    loadTemplate(
      clientFor([{ body: effect }, { body: { design: {}, design_schema: 1 } }]),
      'peony',
    ),
  );
  await assert.rejects(
    loadTemplate(
      clientFor([
        { body: effect },
        { body: { design: effectTemplates[0].design, design_schema: 999 } },
      ]),
      'peony',
    ),
  );
});
