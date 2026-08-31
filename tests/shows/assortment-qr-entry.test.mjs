import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const files = {
  migration: new URL(
    '../../supabase/migrations/20260829090000_add_assortment_qr_entry.sql',
    import.meta.url,
  ),
  provenanceRepair: new URL(
    '../../supabase/migrations/20260831032143_fix_assortment_qr_show_provenance.sql',
    import.meta.url,
  ),
  snapshotRepair: new URL(
    '../../supabase/migrations/20260831032648_fix_assortment_qr_show_snapshot.sql',
    import.meta.url,
  ),
  creditReservationRepair: new URL(
    '../../supabase/migrations/20260831090001_fix_assortment_qr_credit_reservation.sql',
    import.meta.url,
  ),
  adminActions: new URL('../../app/actions/admin-assortments.ts', import.meta.url),
  adminEditor: new URL(
    '../../app/(admin)/admin/assortments/[id]/AssortmentEditor.tsx',
    import.meta.url,
  ),
  publicServer: new URL('../../lib/assortments/public.server.ts', import.meta.url),
  constraints: new URL('../../lib/assortments/constraints.ts', import.meta.url),
  loaders: new URL('../../lib/cue-generation/loaders.server.ts', import.meta.url),
  runner: new URL('../../lib/cue-generation/runner.server.ts', import.meta.url),
  fast: new URL('../../lib/cue-generation/fast-planner.ts', import.meta.url),
  beat: new URL('../../lib/cue-generation/beat-sync-planner.ts', import.meta.url),
  kioskPage: new URL('../../app/(kiosk)/a/[token]/page.tsx', import.meta.url),
  kioskLayout: new URL('../../app/(kiosk)/layout.tsx', import.meta.url),
  kioskClient: new URL('../../app/(kiosk)/a/[token]/AssortmentEntryClient.tsx', import.meta.url),
  kioskShowPage: new URL('../../app/(kiosk)/a/[token]/show/[showToken]/page.tsx', import.meta.url),
  showsRoute: new URL('../../app/api/assortments/[token]/shows/route.ts', import.meta.url),
  musicRoute: new URL('../../app/api/assortments/[token]/music/route.ts', import.meta.url),
  requestSecurity: new URL('../../lib/assortments/request-security.server.ts', import.meta.url),
  qrRoute: new URL('../../app/api/admin/assortments/[id]/qr/route.ts', import.meta.url),
  packageJson: new URL('../../package.json', import.meta.url),
  environment: new URL('../../.env.example', import.meta.url),
};

async function source(key) {
  return readFile(files[key], 'utf8');
}

async function loadConstraintModule() {
  const implementation = await source('constraints');
  const javascript = ts.transpileModule(implementation, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);
}

test('FIR-168 migration extends rather than recreates FIR-178 contracts', async () => {
  const migration = await source('migration');
  assert.doesNotMatch(migration, /create table public\.assortments\s*\(/);
  assert.doesNotMatch(migration, /create table public\.assortment_items\s*\(/);
  assert.doesNotMatch(migration, /add column assortment_id uuid/);
  assert.doesNotMatch(migration, /insert into public\.permissions/);
  assert.doesNotMatch(migration, /save_assortment_definition/);
  assert.match(migration, /create table public\.assortment_public_links/);
});

test('deployed QR show provenance is repaired without duplicating the original schema', async () => {
  const repair = await source('provenanceRepair');
  assert.match(repair, /add column if not exists assortment_id uuid/);
  assert.match(repair, /references public\.assortments\(id\) on delete set null/);
  assert.match(repair, /create index if not exists shows_assortment_id_idx/);
});

test('QR show snapshots use an unambiguous generated show identifier', async () => {
  const repair = await source('snapshotRepair');
  assert.match(repair, /new_show_id uuid := gen_random_uuid\(\)/);
  assert.match(
    repair,
    /insert into public\.show_assortment_items \(show_id, catalogue_item_id, quantity\)\s+select new_show_id,/,
  );
  assert.doesNotMatch(repair, /\bshow_id uuid := gen_random_uuid\(\)/);
});

test('QR credit reservations use private helpers without requiring an authenticated user', async () => {
  const repair = await source('creditReservationRepair');
  assert.match(repair, /perform private\.ensure_ai_credit_account\(p_user_id\)/);
  assert.match(repair, /usage_row := private\.ai_credit_usage_payload\(p_user_id\)/);
  assert.doesNotMatch(repair, /perform public\.ensure_ai_credit_account\(p_user_id\)/);
  assert.doesNotMatch(repair, /usage_row := public\.ai_credit_usage_payload\(p_user_id\)/);
  assert.match(
    repair,
    /revoke execute on function private\.reserve_assortment_ai_credit\([\s\S]*from public, anon, authenticated, service_role/,
  );
});

test('the protected reusable capability cannot be anonymously enumerated', async () => {
  const [migration, implementation] = await Promise.all([
    source('migration'),
    source('publicServer'),
  ]);
  assert.match(migration, /public_token text not null unique default/);
  assert.match(migration, /revoke all on public\.assortment_public_links from public, anon/);
  assert.doesNotMatch(migration, /grant select[^;]*assortment_public_links[^;]*anon/i);
  assert.match(implementation, /\.from\('assortment_public_links'\)/);
  assert.match(implementation, /\.eq\('is_enabled', true\)/);
  assert.match(implementation, /\.eq\('is_active', true\)/);
});

test('invalid, revoked and inactive links fail before public generation', async () => {
  const [migration, implementation] = await Promise.all([
    source('migration'),
    source('publicServer'),
  ]);
  assert.match(implementation, /if \(!isAssortmentPublicToken\(token\)\) return null/);
  assert.equal((migration.match(/link\.is_enabled = true/g) ?? []).length >= 2, true);
  assert.equal((migration.match(/assortment\.is_active = true/g) ?? []).length >= 2, true);
  assert.equal(
    (migration.match(/auth\.role\(\) is distinct from 'service_role'/g) ?? []).length,
    2,
  );
});

test('FIR-178 admin CRUD remains canonical and receives only QR controls', async () => {
  const [actions, editor] = await Promise.all([source('adminActions'), source('adminEditor')]);
  assert.match(actions, /export async function updateAssortment/);
  assert.match(actions, /export async function upsertAssortmentItem/);
  assert.match(actions, /export async function deleteAssortmentItem/);
  assert.doesNotMatch(actions, /save_assortment_definition/);
  assert.match(actions, /created_by: profile\.id/);
  assert.match(editor, /Reusable QR code/);
  assert.match(editor, /Copy URL/);
  assert.match(editor, /Download/);
});

test('the kiosk flow is public, fixed and does not create a consumer identity', async () => {
  const [page, client, layout] = await Promise.all([
    source('kioskPage'),
    source('kioskClient'),
    source('kioskLayout'),
  ]);
  assert.doesNotMatch(page, /getUser|getCurrentProfile|redirect\('\/login/);
  assert.doesNotMatch(client, /signInAnonymously|signInWith/);
  assert.doesNotMatch(client, /catalogue browser|custom mode|Entry Point 1/i);
  assert.match(client, /Locked/);
  assert.match(client, /\/api\/assortments\/\$\{token\}\/music/);
  assert.match(layout, /index: false/);
  assert.match(layout, /follow: false/);
});

test('new assortment foreign keys and RLS lookups are indexed', async () => {
  const migration = await source('migration');
  assert.match(migration, /assortment_public_links \(funding_user_id\)/);
  assert.match(migration, /assortment_song_selections \(funding_user_id\)/);
  assert.match(migration, /shows \(assortment_song_selection_id\)/);
  assert.match(migration, /show_assortment_items \(catalogue_item_id\)/);
});

test('the retailer funding user pays for analysis and generation', async () => {
  const [migration, implementation] = await Promise.all([
    source('migration'),
    source('publicServer'),
  ]);
  assert.match(migration, /funding_user_id uuid not null references public\.users/);
  assert.equal(
    (migration.match(/private\.reserve_assortment_ai_credit\(/g) ?? []).length >= 3,
    true,
  );
  assert.match(migration, /link_row\.funding_user_id/);
  assert.match(implementation, /fundingUserId/);
  assert.doesNotMatch(implementation, /ownerUserId|owner_user_id/);
});

test('initial generation snapshots current FIR-178 items and regeneration copies V1', async () => {
  const [migration, route, implementation, showPage] = await Promise.all([
    source('migration'),
    source('showsRoute'),
    source('publicServer'),
    source('kioskShowPage'),
  ]);
  assert.match(
    migration,
    /if p_source_show_id is not null then[\s\S]*from public\.show_assortment_items snapshot[\s\S]*else[\s\S]*from public\.assortment_items item/,
  );
  assert.match(route, /sourceShowId = priorShow\.id/);
  assert.match(route, /sourceShowId,/);
  assert.match(implementation, /p_source_show_id: params\.sourceShowId \?\? null/);
  assert.match(implementation, /show_assortment_items \(/);
  assert.match(showPage, /show\.snapshotItems/);
  assert.match(showPage, /show\.budgetCents/);
});

test('QR generation uses immutable snapshot products while normal generation keeps FIR-178 filtering', async () => {
  const [runner, loaders] = await Promise.all([source('runner'), source('loaders')]);
  assert.match(runner, /brief\.creation_source === 'assortment_qr'/);
  assert.match(runner, /loadShowAssortmentLedger\(supabase, showId\)/);
  assert.match(runner, /loadAssortmentCatalogueItemIds/);
  assert.match(runner, /if \(assortmentLedger\)[\s\S]*else \{[\s\S]*minPriceCents/);
  assert.match(loaders, /\.from\('show_assortment_items'\)/);
  assert.match(loaders, /\.from\('assortment_items'\)/);
});

test('exact ledger accepts A2 B1 C3 and rejects under, over and unknown products', async () => {
  const { exactProductQuantityMismatches, requireExactProductQuantityLedger } =
    await loadConstraintModule();
  const ledger = new Map([
    ['A', 2],
    ['B', 1],
    ['C', 3],
  ]);
  const exact = ['A', 'C', 'B', 'A', 'C', 'C'].map((productId) => ({ productId }));
  assert.deepEqual(exactProductQuantityMismatches(exact, ledger), []);
  assert.equal(requireExactProductQuantityLedger(exact, ledger, 'Test').length, 6);
  assert.deepEqual(exactProductQuantityMismatches(exact.slice(0, -1), ledger), [
    { productId: 'C', expected: 3, actual: 2 },
  ]);
  assert.equal(exactProductQuantityMismatches([...exact, { productId: 'A' }], ledger)[0].actual, 3);
  assert.deepEqual(exactProductQuantityMismatches([...exact, { productId: 'X' }], ledger)[0], {
    productId: 'X',
    expected: 0,
    actual: 1,
  });
});

test('fast, beat, LLM, fallback and final validation all require exact use', async () => {
  const [runner, fast, beat] = await Promise.all([
    source('runner'),
    source('fast'),
    source('beat'),
  ]);
  assert.match(fast, /requireExactProductQuantityLedger\(\s*cues,\s*availabilityByProductId/);
  assert.match(beat, /requireExactProductQuantityLedger\(\s*cues,\s*availabilityByProductId/);
  assert.match(runner, /requiredProductQuantities: assortmentLedger/);
  assert.match(runner, /quantityMismatches\.length > 0[\s\S]*runBeatFallback\(\)/);
  assert.match(runner, /requireExactProductQuantityLedger\([\s\S]*'Final cue validation'/);
});

test('database persistence rejects unknown, overused and underused snapshot products', async () => {
  const migration = await source('migration');
  assert.match(migration, /snapshot\.catalogue_item_id is null/);
  assert.match(migration, /<> snapshot\.quantity/);
  assert.match(migration, /must consume every assortment product exactly once per purchased unit/);
  assert.match(
    migration,
    /revoke execute on function public\.replace_show_timeline_items[\s\S]*from public, anon, authenticated, service_role/,
  );
});

test('public song and show capabilities stay server-mediated and hash private access tokens', async () => {
  const [migration, implementation] = await Promise.all([
    source('migration'),
    source('publicServer'),
  ]);
  assert.match(migration, /access_token_hash text not null unique/);
  assert.match(migration, /public_access_token_hash text/);
  assert.match(implementation, /hashCapabilityToken/);
  assert.match(implementation, /createServiceRoleSupabase/);
  assert.doesNotMatch(migration, /grant (?:insert|update|delete)[^;]* to anon/i);
});

test('QR preview and download use the stable protected link', async () => {
  const [route, packageJson] = await Promise.all([source('qrRoute'), source('packageJson')]);
  const parsedPackage = JSON.parse(packageJson);
  assert.match(parsedPackage.dependencies.qrcode, /^\^1\.5\.4$/);
  assert.match(route, /assortment\.publicLink\.publicToken/);
  assert.match(route, /renderAssortmentQrSvg/);
  assert.match(route, /Content-Disposition/);
  assert.match(route, /image\/svg\+xml/);
});

test('public QR routes fail closed without durable production rate limiting', async () => {
  const [environment, musicRoute, showsRoute, requestSecurity] = await Promise.all([
    source('environment'),
    source('musicRoute'),
    source('showsRoute'),
    source('requestSecurity'),
  ]);

  assert.match(environment, /public assortment QR flows/);
  assert.match(environment, /Public QR endpoints fail/);
  assert.match(environment, /closed without this durable cache/);
  assert.match(requestSecurity, /process\.env\.NODE_ENV !== 'production' \|\| result\.durable/);
  assert.match(musicRoute, /if \(!limit\.productionReady\)[\s\S]*503/);
  assert.match(showsRoute, /if \(!limit\.productionReady\)[\s\S]*503/);
});
