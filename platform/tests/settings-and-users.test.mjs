/** Static-analysis "grep the source" test guarding settings and admin-users invariants (do not modify test bodies). */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';

const root = process.cwd();

test('settings exposes modern account sections', () => {
  const layout = readFileSync(join(root, 'app/(app)/settings/layout.tsx'), 'utf8');
  const header = readFileSync(join(root, 'app/(app)/settings/SettingsPageHeader.tsx'), 'utf8');
  const profile = readFileSync(join(root, 'app/(app)/settings/profile/page.tsx'), 'utf8');
  const personalDetails = readFileSync(
    join(root, 'app/(app)/settings/profile/PersonalDetailsForm.tsx'),
    'utf8',
  );
  for (const label of ['Personal details', 'Notifications', 'Billing', 'Security']) {
    assert.match(header, new RegExp(label));
  }
  assert.match(layout, /SettingsPageHeader/);
  assert.match(profile, /PersonalDetailsForm/);
  assert.match(personalDetails, /Interface theme/);
  assert.equal(existsSync(join(root, 'app/(app)/settings/billing/page.tsx')), true);
  assert.equal(existsSync(join(root, 'app/(app)/settings/notifications/page.tsx')), true);
});

test('profile theme preference is persisted by profile actions and schema', () => {
  const action = readFileSync(join(root, 'app/actions/platform-admin.ts'), 'utf8');
  const migration = readFileSync(
    join(root, 'supabase/migrations/0006_theme_preference_and_library_performance.sql'),
    'utf8',
  );
  assert.match(action, /themePreference/);
  assert.match(action, /theme_preference/);
  assert.match(migration, /theme_preference text not null default 'dark'/);
});

test('admin users page is table/search first and detail page handles edits', () => {
  const usersPage = readFileSync(join(root, 'app/(admin)/admin/users/page.tsx'), 'utf8');
  const detailPage = readFileSync(join(root, 'app/(admin)/admin/users/[id]/page.tsx'), 'utf8');
  assert.match(usersPage, /Search name, email, phone/);
  assert.match(usersPage, /<table/);
  assert.match(usersPage, /const href = `\/admin\/users\/\$\{user\.id\}`/);
  assert.match(detailPage, /UserRoleSelect/);
  assert.match(detailPage, /Permission overrides/);
});
