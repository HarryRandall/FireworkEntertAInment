/** Static guards for the July database privilege and integrity checkpoint. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

const privilegeMigration = read(
  'supabase/migrations/20260710010350_harden_database_privileges.sql',
);
const integrityMigration = read('supabase/migrations/20260710010351_optimise_schema_integrity.sql');
const cueMigration = read(
  'supabase/migrations/20260710010353_canonicalise_published_show_preset_cues.sql',
);
const provenanceMigration = read(
  'supabase/migrations/20260710011537_add_show_preset_source_provenance.sql',
);
const likeMigration = read('supabase/migrations/20260710011816_add_show_preset_likes.sql');
const scheduleMigration = read(
  'supabase/migrations/20260710012517_schedule_published_show_preset_cues.sql',
);
const multishotMigration = read(
  'supabase/migrations/20260710013955_align_multishot_constraints_and_catalogue.sql',
);
const analysisCleanupMigration = read(
  'supabase/migrations/20260710020448_discard_unused_song_analyses.sql',
);
const rlsPerformanceMigration = read(
  'supabase/migrations/20260710023403_optimise_remaining_rls_policies.sql',
);
const activePermissionMigration = read(
  'supabase/migrations/20260715083410_require_active_permission_users.sql',
);

test('AI credit internals are private and public wrappers deny anonymous or cross-user access', () => {
  assert.match(privilegeMigration, /create schema if not exists private/);
  assert.match(
    privilegeMigration,
    /create or replace function private\.ai_credit_usage_payload\(p_user_id uuid\)/,
  );
  assert.match(
    privilegeMigration,
    /create or replace function private\.ensure_ai_credit_account\(p_user_id uuid\)/,
  );
  assert.match(
    privilegeMigration,
    /revoke execute on function private\.ensure_ai_credit_account\(uuid\)[\s\S]*?from public, anon, authenticated, service_role/,
  );
  assert.match(
    privilegeMigration,
    /create or replace function public\.ai_credit_usage_payload\(p_user_id uuid\)[\s\S]*?if auth\.uid\(\) is null[\s\S]*?auth\.uid\(\) <> p_user_id/,
  );
  assert.match(
    privilegeMigration,
    /create or replace function public\.ensure_ai_credit_account\(p_user_id uuid\)[\s\S]*?if auth\.uid\(\) is null[\s\S]*?private\.ensure_ai_credit_account\(p_user_id\)/,
  );
  assert.match(
    privilegeMigration,
    /create trigger users_ai_credit_account[\s\S]*?private\.ensure_ai_credit_account_for_user\(\)/,
  );
  assert.match(
    privilegeMigration,
    /revoke execute on all functions in schema public from public, anon, authenticated/,
  );
  assert.match(
    privilegeMigration,
    /grant execute on function public\.reserve_ai_credits\([\s\S]*?to authenticated/,
  );
  assert.doesNotMatch(privilegeMigration, /grant execute on function public\.has_permission/);
});

test('every application RPC has an explicit authenticated execution grant', () => {
  const rpcSources = [
    'app/actions/admin-multishots.ts',
    'app/actions/show-preset-likes.ts',
    'app/api/music-analysis/route.ts',
    'lib/admin/current-user.server.ts',
    'lib/ai-credits.server.ts',
    'lib/cue-generation/runner.server.ts',
  ]
    .map(read)
    .join('\n');
  const rpcNames = new Set(
    [...rpcSources.matchAll(/\.rpc\(\s*['"]([^'"]+)['"]/g)].map((match) => match[1]),
  );
  assert.deepEqual([...rpcNames].sort(), [
    'current_user_access',
    'discard_unused_song_analysis',
    'ensure_ai_credit_account',
    'grant_ai_credits',
    'refund_ai_credit_reservation',
    'replace_show_timeline_items',
    'reserve_ai_credits',
    'settle_ai_credit_reservation',
    'sync_multishot_derived_state',
    'toggle_show_preset_like',
  ]);

  const finalGrantMigrations = `${privilegeMigration}\n${likeMigration}\n${multishotMigration}\n${analysisCleanupMigration}`;
  for (const rpcName of rpcNames) {
    assert.match(
      finalGrantMigrations,
      new RegExp(`grant execute on function public\\.${rpcName}\\(`),
    );
  }
});

test('signup selects one role before insert and repairs the bootstrap admin', () => {
  assert.match(
    privilegeMigration,
    /assigned_role_key := case[\s\S]*?randallhazza@gmail\.com[\s\S]*?then 'admin'[\s\S]*?else 'user'/,
  );
  assert.match(
    privilegeMigration,
    /insert into public\.user_roles \(user_id, role_id\)[\s\S]*?on conflict \(user_id\) do update/,
  );
  assert.match(
    privilegeMigration,
    /from public\.users app_user[\s\S]*?admin_role\.key = 'admin'[\s\S]*?on conflict \(user_id\) do update/,
  );
});

test('Data API grants are least privilege while anonymous browse joins remain available', () => {
  assert.match(
    privilegeMigration,
    /revoke all privileges on all tables in schema public from anon/,
  );
  for (const table of [
    'show_presets',
    'catalogue_items',
    'fireworks',
    'firework_effects',
    'multishots',
    'multishot_fireworks',
  ]) {
    assert.match(privilegeMigration, new RegExp(`public\\.${table}`));
  }
  assert.match(
    privilegeMigration,
    /revoke all privileges on all tables in schema public from authenticated/,
  );
  assert.match(
    privilegeMigration,
    /alter default privileges for role postgres in schema public[\s\S]*?revoke all on tables from anon/,
  );
  assert.match(
    privilegeMigration,
    /alter default privileges for role postgres in schema public[\s\S]*?revoke all on tables from authenticated/,
  );
  assert.doesNotMatch(
    privilegeMigration,
    /alter default privileges[\s\S]*?grant select, insert, update, delete on tables to authenticated/,
  );
  for (const grant of [
    /grant select on table[\s\S]*?public\.ai_credit_accounts,[\s\S]*?public\.supplier_inventory_items[\s\S]*?to authenticated/,
    /grant select, update on table[\s\S]*?public\.prompt_configs,[\s\S]*?public\.users[\s\S]*?to authenticated/,
    /grant select, insert on table[\s\S]*?public\.firework_editor_versions,[\s\S]*?public\.media_assets[\s\S]*?to authenticated/,
    /grant select, insert, update on table[\s\S]*?public\.catalogue_items,[\s\S]*?public\.user_roles[\s\S]*?to authenticated/,
    /grant select, insert, delete on table[\s\S]*?public\.show_timeline_items[\s\S]*?to authenticated/,
    /grant select, insert, update, delete on table[\s\S]*?public\.import_jobs,[\s\S]*?public\.user_permission_overrides[\s\S]*?to authenticated/,
  ]) {
    assert.match(privilegeMigration, grant);
  }
  assert.match(
    privilegeMigration,
    /create policy firework_effects_select_anyone[\s\S]*?for select to anon, authenticated/,
  );
  assert.match(
    privilegeMigration,
    /create policy show_presets_read_published_anon[\s\S]*?for select to anon[\s\S]*?using \(is_published\)/,
  );
  assert.match(
    privilegeMigration,
    /alter function public\.block_linked_catalogue_item_delete\(\) set search_path = ''/,
  );
  assert.match(
    privilegeMigration,
    /drop policy if exists covers_select_anyone on storage\.objects/,
  );
  assert.doesNotMatch(privilegeMigration, /for all to authenticated/);
  for (const table of [
    'show_presets',
    'catalogue_items',
    'fireworks',
    'firework_effects',
    'multishots',
    'multishot_fireworks',
  ]) {
    for (const operation of ['insert', 'update', 'delete']) {
      assert.match(
        privilegeMigration,
        new RegExp(`create policy ${table}_admin_${operation} on public\\.${table}`),
      );
    }
  }
});

test('remaining app RLS policies initialise auth once and do not overlap by command', () => {
  const policyStatements = [...rlsPerformanceMigration.matchAll(/create policy[\s\S]*?;/g)].map(
    (match) => match[0],
  );
  assert.equal(policyStatements.length, 44);
  for (const statement of policyStatements) {
    assert.match(statement, /to authenticated/);
    assert.doesNotMatch(statement, /for all/);
  }

  const withoutSelectedUid = rlsPerformanceMigration.replaceAll('(select auth.uid())', '');
  assert.doesNotMatch(withoutSelectedUid, /auth\.uid\(\)/);
  const withoutSelectedPermission = rlsPerformanceMigration.replace(
    /\(select public\.current_user_has_permission\('[^']+'\)\)/g,
    '',
  );
  assert.doesNotMatch(withoutSelectedPermission, /public\.current_user_has_permission\(/);

  for (const oldPolicy of [
    'users_admin_select_all',
    'users_admin_update_all',
    'role_permissions_admin_modify',
    'user_roles_admin_modify',
    'user_permission_overrides_admin_modify',
    'media_assets_admin_modify',
    'firework_style_defaults_admin_modify',
    'import_jobs_admin_modify',
    'import_outputs_admin_modify',
    'supplier_profiles_modify_allowed',
    'supplier_inventory_modify_allowed',
    'ai_credit_costs_manage_billing_admin',
  ]) {
    assert.match(rlsPerformanceMigration, new RegExp(`drop policy if exists ${oldPolicy}`));
  }

  assert.match(
    rlsPerformanceMigration,
    /create policy users_select_own_or_admin[\s\S]*?auth\.uid\(\)[\s\S]*?admin\.manage_users/,
  );
  assert.match(
    rlsPerformanceMigration,
    /create policy users_update_own_or_admin[\s\S]*?for update to authenticated[\s\S]*?with check/,
  );
  assert.match(
    rlsPerformanceMigration,
    /create policy media_assets_insert_allowed[\s\S]*?owner_id = \(select auth\.uid\(\)\)[\s\S]*?admin\.manage_imports/,
  );
  for (const table of ['supplier_profiles', 'supplier_inventory']) {
    assert.match(
      rlsPerformanceMigration,
      new RegExp(
        `create policy ${table}_select_allowed[\\s\\S]*?supplier\\.view[\\s\\S]*?supplier\\.manage_stock`,
      ),
    );
  }

  assert.match(rlsPerformanceMigration, /'public' = any\(roles\)/);
  assert.match(rlsPerformanceMigration, /having count\(\*\) > 1/);
  assert.doesNotMatch(rlsPerformanceMigration, /^\s*(?:grant|revoke)\b/gm);
});

test('storage writes require a current active app user and cover upserts retain owner SELECT', () => {
  assert.match(
    privilegeMigration,
    /create or replace function public\.current_user_is_active\(\)[\s\S]*?from public\.users app_user[\s\S]*?app_user\.status = 'active'/,
  );
  assert.match(
    privilegeMigration,
    /revoke execute on function public\.current_user_is_active\(\)[\s\S]*?from public, anon/,
  );
  assert.match(
    privilegeMigration,
    /grant execute on function public\.current_user_is_active\(\) to authenticated/,
  );
  for (const policy of [
    'audio_read_own',
    'audio_insert_own',
    'audio_update_own',
    'audio_delete_own',
    'covers_select_own',
    'covers_insert_own',
    'covers_update_own',
    'covers_delete_own',
  ]) {
    assert.match(
      privilegeMigration,
      new RegExp(
        `create policy ${policy} on storage\\.objects[\\s\\S]*?current_user_is_active\\(\\)`,
      ),
    );
  }
  assert.match(
    privilegeMigration,
    /create policy covers_select_own on storage\.objects[\s\S]*?for select to authenticated[\s\S]*?storage\.foldername\(name\)/,
  );
});

test('effective permissions require a live active account', () => {
  assert.match(
    activePermissionMigration,
    /create or replace function public\.current_user_has_permission\(permission_key text\)/,
  );
  assert.match(activePermissionMigration, /security definer/);
  assert.match(activePermissionMigration, /set search_path = ''/);
  assert.match(
    activePermissionMigration,
    /from public\.users app_user[\s\S]*?app_user\.id = \(select auth\.uid\(\)\)[\s\S]*?app_user\.status = 'active'/,
  );
  assert.match(activePermissionMigration, /public\.has_permission\(app_user\.id, permission_key\)/);
  assert.match(
    activePermissionMigration,
    /revoke execute on function public\.current_user_has_permission\(text\)[\s\S]*?from public, anon, service_role/,
  );
  assert.match(
    activePermissionMigration,
    /grant execute on function public\.current_user_has_permission\(text\)[\s\S]*?to authenticated/,
  );
});

test('anonymous Explore reads cannot expose generated-show provenance', () => {
  assert.match(provenanceMigration, /revoke select on table public\.show_presets from anon/);
  assert.match(
    provenanceMigration,
    /grant select \([\s\S]*?preview_cues[\s\S]*?published_at[\s\S]*?\) on table public\.show_presets to anon/,
  );
  const publicGrant = provenanceMigration.slice(
    provenanceMigration.indexOf('grant select ('),
    provenanceMigration.indexOf(') on table public.show_presets to anon;') + 1,
  );
  assert.doesNotMatch(publicGrant, /source_show_id/);
  assert.match(
    provenanceMigration,
    /has_column_privilege\('anon', 'public\.show_presets', 'source_show_id', 'select'\)/,
  );
});

test('core show policies cache auth identity and do not overlap timeline reads', () => {
  for (const table of ['shows', 'song_analyses', 'show_generation_runs']) {
    for (const operation of ['select', 'insert', 'update', 'delete']) {
      assert.match(
        privilegeMigration,
        new RegExp(`create policy ${table}_${operation}_own on public\\.${table}`),
      );
    }
  }

  assert.match(privilegeMigration, /\(select auth\.uid\(\)\)/);
  assert.doesNotMatch(privilegeMigration, /create policy show_timeline_items_modify_via_show/);
  for (const operation of ['select', 'insert', 'update', 'delete']) {
    assert.match(
      privilegeMigration,
      new RegExp(
        `create policy show_timeline_items_${operation}_via_show on public\\.show_timeline_items`,
      ),
    );
  }
});

test('missing foreign-key indexes and exact duplicate schema objects are handled', () => {
  for (const index of [
    'ai_credit_costs_updated_by_idx',
    'ai_credit_transactions_created_by_idx',
    'firework_editor_versions_created_by_idx',
    'generation_settings_updated_by_idx',
    'import_jobs_created_by_idx',
    'import_jobs_media_asset_id_idx',
    'media_assets_owner_id_idx',
    'prompt_configs_updated_by_idx',
    'role_permissions_permission_id_idx',
    'show_timeline_items_catalogue_item_id_idx',
    'supplier_inventory_items_updated_by_idx',
    'user_permission_overrides_assigned_by_idx',
    'user_permission_overrides_permission_id_idx',
    'user_roles_assigned_by_idx',
    'user_roles_role_id_idx',
  ]) {
    assert.match(integrityMigration, new RegExp(`create index if not exists ${index}`));
  }
  assert.match(
    integrityMigration,
    /drop index if exists public\.multishot_fireworks_multishot_id_idx/,
  );
  assert.match(integrityMigration, /drop index if exists public\.user_roles_user_id_idx/);
  assert.match(
    integrityMigration,
    /drop policy if exists firework_variants_select_authenticated on public\.fireworks/,
  );
  assert.match(
    integrityMigration,
    /drop policy if exists firework_variants_admin_modify on public\.fireworks/,
  );
});

test('show preset constraints are preflighted and publication is opt-in', () => {
  assert.match(integrityMigration, /alter column is_published set default false/);
  assert.match(integrityMigration, /contains non-positive duration_seconds values/);
  assert.match(integrityMigration, /preview_cues must contain JSON arrays/);
  for (const constraint of [
    'show_presets_duration_positive',
    'show_presets_budget_nonnegative',
    'show_presets_total_nonnegative',
    'show_presets_effects_nonnegative',
    'show_presets_sort_order_nonnegative',
    'show_presets_preview_cues_array',
  ]) {
    assert.match(integrityMigration, new RegExp(`add constraint ${constraint}`));
  }
});

test('shows and timeline rows enforce the domain values used by the application', () => {
  assert.match(integrityMigration, /show_timeline_items_show_id_position_key/);
  assert.match(integrityMigration, /alter column position drop default/);
  assert.match(integrityMigration, /alter column time_seconds set not null/);
  for (const constraint of [
    'show_timeline_items_position_positive',
    'show_timeline_items_time_nonnegative',
    'shows_duration_positive',
    'shows_budget_nonnegative',
    'shows_total_nonnegative',
    'shows_effects_nonnegative',
    'shows_safety_nonnegative',
    'shows_sync_percent_range',
  ]) {
    assert.match(integrityMigration, new RegExp(`add constraint ${constraint}`));
  }
});

test('published cue canonicalisation is lossless, unambiguous and preserves timestamps', () => {
  assert.match(cueMigration, /show_preset_cue_canonicalisation/);
  assert.match(cueMigration, /Published show preset cue mapping is ambiguous/);
  assert.match(cueMigration, /no unambiguous catalogue mapping/);
  assert.match(cueMigration, /mapped_cue_count <> published_cue_count/);
  assert.match(cueMigration, /cue - 'fireworkSlug'/);
  assert.match(cueMigration, /'catalogueItemId', target_catalogue_item_id/);
  assert.match(cueMigration, /'catalogueItemSlug', target_catalogue_item_slug/);
  assert.match(cueMigration, /disable trigger show_templates_set_updated_at/);
  assert.match(cueMigration, /updated_at = rebuilt\.original_updated_at/);
  assert.match(cueMigration, /enable trigger show_templates_set_updated_at/);
  assert.match(cueMigration, /final_cue_count <> mapped_cue_count/);
});

test('published presets enforce complete, resolvable and overlap-free cue timing', () => {
  assert.doesNotMatch(scheduleMigration, /declare\s+preset record;/);
  assert.match(
    scheduleMigration,
    /create or replace function private\.catalogue_item_safe_duration\([\s\S]*?0\.5::numeric/,
  );
  assert.match(
    scheduleMigration,
    /create or replace function private\.assert_show_preset_publishable\([\s\S]*?requires a positive duration[\s\S]*?requires published_at[\s\S]*?requires a non-empty cue array/,
  );
  assert.match(scheduleMigration, /has an invalid catalogue item ID/);
  assert.match(scheduleMigration, /has an invalid catalogue item slug/);
  assert.match(scheduleMigration, /has a stale catalogue item slug/);
  assert.match(scheduleMigration, /has an invalid description/);
  assert.match(scheduleMigration, /has an invalid emphasis/);
  assert.match(scheduleMigration, /references a missing catalogue item/);
  assert.match(scheduleMigration, /ends after the show duration/);
  assert.match(scheduleMigration, /overlaps launch position/);
  assert.match(scheduleMigration, /add constraint show_presets_published_shape/);
  assert.match(
    scheduleMigration,
    /create trigger show_presets_validate_publication[\s\S]*?before insert or update on public\.show_presets/,
  );
  assert.match(
    scheduleMigration,
    /create trigger catalogue_items_validate_published_timing[\s\S]*?after update of part_number, duration_seconds, firework_id, multishot_id/,
  );
  assert.match(
    scheduleMigration,
    /create trigger fireworks_validate_published_timing[\s\S]*?after update of duration_seconds/,
  );
  assert.match(scheduleMigration, /used by a published show preset and cannot be deleted/);
});
