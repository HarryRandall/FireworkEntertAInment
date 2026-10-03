// Verify seeded Auth personas and the application's actual typed template loader locally.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { supabase } from './runtime.mjs';
import { effectTemplates } from '../../packages/fireworks/src/templates/index.ts';
import { verifyPlannerInputs } from './planner-input.integration.mjs';
import { loadTemplate } from '../../apps/web/lib/supabase/load-template.ts';

const requireWeb = createRequire(new URL('../../apps/web/package.json', import.meta.url));
const { createClient } = requireWeb('@supabase/supabase-js');
const status = JSON.parse(supabase(['status', '--output', 'json']));
assert.equal(status.API_URL, 'http://127.0.0.1:55421');
const client = createClient(status.API_URL, status.ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
for (const template of effectTemplates) {
  const stored = await loadTemplate(client, template.key);
  assert.deepEqual(stored, { ...template });
}
await assert.rejects(loadTemplate(client, 'nonexistent-template'));
console.log(
  `Public template loader verified ${effectTemplates.length} stored designs and missing-row failure.`,
);
for (const persona of ['admin', 'owner', 'manager', 'supplier', 'other-owner', 'shopper']) {
  const { data, error } = await client.auth.signInWithPassword({
    email: `${persona}@showcrafter.test`,
    password: 'LocalShowcrafter123!',
  });
  assert.equal(error, null, `${persona} local sign-in`);
  assert.ok(data.user);
  const profile = await client.from('profiles').select('id').eq('id', data.user.id).single();
  assert.equal(profile.error, null);
  const range = await client.from('range_items').select('id');
  assert.equal(range.error, null);
  assert.equal(range.data.length, ['admin', 'owner', 'manager'].includes(persona) ? 4 : 0);
  const stores = await client.from('stores').select('id');
  assert.equal(stores.error, null);
  assert.equal(
    stores.data.length,
    { admin: 3, owner: 2, manager: 1, supplier: 0, 'other-owner': 1, shopper: 0 }[persona],
  );
  const signedOut = await client.auth.signOut({ scope: 'local' });
  assert.equal(signedOut.error, null);
}
console.log('Six local email personas signed in with the expected tenant and store boundaries.');

await verifyPlannerInputs(client);
