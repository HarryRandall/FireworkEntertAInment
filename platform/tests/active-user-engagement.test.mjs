/** Static guards for live user checks on public engagement mutations. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260715102521_require_active_user_engagement.sql'),
  'utf8',
);

function policyBlock(policyName) {
  const match = migration.match(new RegExp(`create policy ${policyName}[\\s\\S]*?;`));
  assert.ok(match, `Missing ${policyName} policy.`);
  return match[0];
}

function functionBlock(functionName) {
  const match = migration.match(
    new RegExp(`create or replace function public\\.${functionName}\\([\\s\\S]*?\\n\\$\\$;`),
  );
  assert.ok(match, `Missing ${functionName} function.`);
  return match[0];
}

test('remaining public owner policies consult the live user row', () => {
  for (const policyName of [
    'users_insert_own',
    'users_update_own',
    'show_preset_likes_insert_own',
    'show_preset_likes_delete_own',
    'media_assets_insert_allowed',
  ]) {
    assert.match(policyBlock(policyName), /public\.current_user_is_active\(\)/);
  }

  assert.equal(
    policyBlock('users_update_own').match(/public\.current_user_is_active\(\)/g)?.length,
    2,
    'users_update_own must guard both USING and WITH CHECK.',
  );
  assert.match(
    policyBlock('media_assets_insert_allowed'),
    /public\.current_user_has_permission\('admin\.manage_imports'\)/,
  );
});

test('public engagement RPCs reject suspension before protected data access', () => {
  const ensureAccount = functionBlock('ensure_ai_credit_account');
  const toggleLike = functionBlock('toggle_show_preset_like');

  for (const block of [ensureAccount, toggleLike]) {
    assert.match(block, /security definer\s+set search_path = ''/);
    assert.match(block, /not coalesce\(public\.current_user_is_active\(\), false\)/);
  }

  assert.ok(
    ensureAccount.indexOf('current_user_is_active') <
      ensureAccount.indexOf('private.ensure_ai_credit_account'),
  );
  assert.ok(
    toggleLike.indexOf('current_user_is_active') < toggleLike.indexOf('from public.show_presets'),
  );
});

test('the complete Explore like contract remains intact', () => {
  const toggleLike = functionBlock('toggle_show_preset_like');

  assert.match(toggleLike, /where id = p_show_preset_id\s+and is_published/);
  assert.match(toggleLike, /delete from public\.show_preset_likes/);
  assert.match(toggleLike, /insert into public\.show_preset_likes/);
  assert.match(toggleLike, /on conflict \(show_preset_id, user_id\) do nothing/);
  assert.match(toggleLike, /from public\.show_preset_like_counts/);
  assert.match(toggleLike, /'liked', is_liked/);
  assert.match(toggleLike, /'likeCount', coalesce\(current_count, 0\)/);
});

test('RPC execution grants stay least privilege', () => {
  assert.match(
    migration,
    /revoke execute on function public\.ensure_ai_credit_account\(uuid\)\s+from public, anon, authenticated, service_role;\s+grant execute on function public\.ensure_ai_credit_account\(uuid\)\s+to authenticated, service_role;/,
  );
  assert.match(
    migration,
    /revoke execute on function public\.toggle_show_preset_like\(uuid\)\s+from public, anon, authenticated, service_role;\s+grant execute on function public\.toggle_show_preset_like\(uuid\)\s+to authenticated;/,
  );
});

test('private signup credit provisioning is not replaced by the public guard', () => {
  assert.doesNotMatch(migration, /create or replace function private\./);
  assert.doesNotMatch(migration, /ensure_ai_credit_account_for_user/);
  assert.doesNotMatch(migration, /users_ai_credit_account/);
});
