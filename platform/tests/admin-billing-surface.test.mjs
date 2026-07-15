/** Focused source guard for the permission-scoped admin AI billing surface. */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8');

test('admin navigation and route protect AI billing with the billing permission', () => {
  const shell = read('app/components/admin/AdminShell.tsx');
  const layoutPath = join(root, 'app/(admin)/admin/billing/layout.tsx');

  assert.match(
    shell,
    /href: '\/admin\/billing',[\s\S]*?label: 'AI billing',[\s\S]*?permission: 'admin\.manage_billing'/,
  );
  assert.equal(existsSync(layoutPath), true);

  const layout = readFileSync(layoutPath, 'utf8');
  assert.match(layout, /await requirePermission\('admin\.manage_billing'\)/);
  assert.match(layout, /if \(!profile\) redirect\('\/admin'\)/);
});

test('billing accounts render on the server with truthful credit ledger data', () => {
  const page = read('app/(admin)/admin/billing/page.tsx');
  const table = read('app/(admin)/admin/billing/BillingAccountsTable.tsx');

  assert.doesNotMatch(page, /['"]use client['"]/);
  assert.doesNotMatch(table, /['"]use client['"]/);
  assert.match(page, /<h1[\s\S]*?AI billing[\s\S]*?<\/h1>/);
  assert.match(page, /<Suspense fallback=\{<BillingAccountsTableSkeleton \/>\}>/);
  assert.match(table, /listAdminAiCreditAccounts\(\)/);
  assert.match(table, /profile\.permissions\.includes\('admin\.manage_users'\)/);
  assert.match(table, /canManageUsers \? \(/);
  assert.match(table, /href=\{`\/admin\/users\/\$\{account\.userId\}`\}/);
  assert.match(table, /font-mono text-xs font-medium tabular-nums/);
  assert.match(table, /formatCredits\(account\.available\)/);
  assert.match(table, /formatCredits\(account\.balance\)/);
  assert.match(table, /formatCredits\(account\.reserved\)/);
  assert.match(table, /formatCredits\(account\.totalGranted\)/);
  assert.match(table, /formatCredits\(account\.totalSpent\)/);
  assert.match(table, /<time dateTime=\{account\.updatedAt\}>/);
  assert.match(table, /No AI credit accounts have been created yet\./);
  assert.doesNotMatch(table, /subscription|plan|price/i);
});

test('billing loading chrome preserves the title and every table label', () => {
  const loading = read('app/(admin)/admin/billing/loading.tsx');
  const table = read('app/(admin)/admin/billing/BillingAccountsTable.tsx');

  assert.match(loading, /<h1[\s\S]*?AI billing[\s\S]*?<\/h1>/);
  assert.match(loading, /Review current balances, reservations and ledger totals/);
  assert.match(loading, /<BillingAccountsTableSkeleton \/>/);

  for (const header of [
    'Account',
    'Available',
    'Balance',
    'Reserved',
    'Granted',
    'Spent',
    'Updated',
  ]) {
    assert.match(table, new RegExp(`label: '${header}'`));
  }
  assert.match(table, /tableClasses\('min-w-\[980px\]'\)/);
  assert.match(table, /aria-label="Loading AI credit accounts"/);
});
