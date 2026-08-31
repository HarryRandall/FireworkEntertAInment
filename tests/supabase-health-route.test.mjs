import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const route = readFileSync(join(root, 'app/api/health/supabase/route.ts'), 'utf8');
const publicClient = readFileSync(join(root, 'utils/supabase/public-server.ts'), 'utf8');

test('public Supabase health failures do not disclose internal error details', () => {
  assert.match(route, /function unavailableResponse\(\)/);
  assert.match(route, /createPublicServerSupabase\(\)/);
  assert.match(route, /\.from\('show_presets'\)\.select\('id'\)\.limit\(1\)/);
  assert.doesNotMatch(route, /auth\.getUser\(\)/);
  assert.doesNotMatch(route, /cookies\(\)/);
  assert.match(route, /'Cache-Control': 'no-store, max-age=0'/);
  assert.match(
    route,
    /console\.error\('\[api\/health\/supabase\] public database probe failed:', error\)/,
  );
  assert.doesNotMatch(route, /message:\s*error\.message/);
  assert.doesNotMatch(route, /message:\s*e instanceof Error/);
  assert.doesNotMatch(route, /NEXT_PUBLIC_SUPABASE_/);

  assert.match(publicClient, /persistSession: false/);
  assert.match(publicClient, /detectSessionInUrl: false/);
  assert.doesNotMatch(publicClient, /cookies\(\)/);
});
