/** Static guards for stale-JWT mutation boundaries after user suspension. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260715100524_require_active_owner_mutations.sql'),
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

test('owner mutation policies require the live application user to remain active', () => {
  const insertPolicies = [
    'shows_insert_own',
    'song_analyses_insert_own',
    'show_generation_runs_insert_own',
  ];
  const updatePolicies = [
    'shows_update_own',
    'song_analyses_update_own',
    'show_generation_runs_update_own',
  ];
  const deletePolicies = [
    'shows_delete_own',
    'song_analyses_delete_own',
    'show_generation_runs_delete_own',
  ];

  for (const policyName of [...insertPolicies, ...updatePolicies, ...deletePolicies]) {
    assert.match(policyBlock(policyName), /\(select public\.current_user_is_active\(\)\)/);
  }

  for (const policyName of updatePolicies) {
    const activeChecks = policyBlock(policyName).match(
      /\(select public\.current_user_is_active\(\)\)/g,
    );
    assert.equal(activeChecks?.length, 2, `${policyName} must guard both USING and WITH CHECK.`);
  }
});

test('credit and analysis cleanup RPCs reject suspended users before data access', () => {
  for (const functionName of [
    'reserve_ai_credits',
    'settle_ai_credit_reservation',
    'refund_ai_credit_reservation',
    'discard_unused_song_analysis',
  ]) {
    const block = functionBlock(functionName);
    assert.match(block, /security definer\s+set search_path = ''/);
    assert.match(block, /not coalesce\(public\.current_user_is_active\(\), false\)/);
    assert.equal(block.includes("set search_path to 'public'"), false);
  }

  for (const functionName of [
    'reserve_ai_credits',
    'settle_ai_credit_reservation',
    'refund_ai_credit_reservation',
  ]) {
    const block = functionBlock(functionName);
    assert.ok(
      block.indexOf('current_user_is_active') < block.indexOf('pg_advisory_xact_lock'),
      `${functionName} must reject suspension before locking or replaying a request.`,
    );
  }

  const discardBlock = functionBlock('discard_unused_song_analysis');
  assert.ok(
    discardBlock.indexOf('current_user_is_active') <
      discardBlock.indexOf('select * into v_analysis'),
  );
});

test('guarded RPC execution is limited to authenticated callers', () => {
  const signatures = [
    'reserve_ai_credits\\([\\s\\S]*?jsonb\\)',
    'settle_ai_credit_reservation\\(uuid, text, text, jsonb\\)',
    'refund_ai_credit_reservation\\(uuid, text, text, jsonb\\)',
    'discard_unused_song_analysis\\(uuid, text\\)',
  ];

  for (const signature of signatures) {
    assert.match(
      migration,
      new RegExp(
        `revoke execute on function public\\.${signature}[\\s\\S]*?from public, anon, authenticated, service_role;`,
      ),
    );
    assert.match(
      migration,
      new RegExp(`grant execute on function public\\.${signature}[\\s\\S]*?to authenticated;`),
    );
  }
});

test('timeline mutation ownership remains delegated to its dedicated migration', () => {
  assert.doesNotMatch(migration, /show_timeline_items/);
  assert.doesNotMatch(migration, /replace_show_timeline_items/);
});
