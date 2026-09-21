import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getLocalIntegrationNotices, usesLocalSupabase } from '../../lib/local-integrations.ts';

test('local diagnostics are absent for hosted or invalid database URLs', () => {
  for (const url of [
    '',
    'invalid',
    'https://example.supabase.co',
    'https://localhost.example.org',
  ]) {
    assert.equal(usesLocalSupabase({ NEXT_PUBLIC_SUPABASE_URL: url }), false);
    assert.deepEqual(getLocalIntegrationNotices({ NEXT_PUBLIC_SUPABASE_URL: url }), []);
  }
});

test('missing services name the required keys without preventing local planning', () => {
  const notices = getLocalIntegrationNotices({
    NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:55421',
  });
  assert.equal(notices.length, 4);
  const messages = notices.map((notice) => notice.message).join('\n');
  assert.match(messages, /ANALYSER_URL and ANALYSER_SHARED_SECRET/);
  assert.match(messages, /JAMENDO_CLIENT_ID/);
  assert.match(messages, /Local fast and beat planning do not need this key/);
  assert.match(messages, /worker must be running/);
});

test('configured hosted services still explain local reachability without exposing credentials', () => {
  const notices = getLocalIntegrationNotices({
    NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:55421',
    ANALYSER_URL: 'https://analyser.modal.run',
    ANALYSER_SHARED_SECRET: 'private-analyser-secret',
    FIREWORK_IMPORT_URL: 'https://worker.modal.run',
    FIREWORK_IMPORT_SHARED_SECRET: 'private-import-secret',
    OPENROUTER_API_KEY: 'private-model-secret',
    JAMENDO_CLIENT_ID: 'private-client-id',
  });
  assert.equal(notices.length, 2);
  const messages = JSON.stringify(notices);
  assert.match(messages, /cannot fetch audio from localhost/);
  assert.match(messages, /reachable development database/);
  assert.doesNotMatch(messages, /private-/);
});
