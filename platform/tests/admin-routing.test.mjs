import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { join } from "node:path";

const root = process.cwd();

test("admin route group owns /admin outside the app shell", () => {
  assert.equal(existsSync(join(root, "app/(admin)/layout.tsx")), true);
  assert.equal(existsSync(join(root, "app/(admin)/loading.tsx")), true);
  assert.equal(existsSync(join(root, "app/(admin)/error.tsx")), true);
  assert.equal(existsSync(join(root, "app/(admin)/admin/page.tsx")), true);
  assert.equal(existsSync(join(root, "app/(app)/admin/page.tsx")), false);
});

test("admin shell has its own navigation and back-to-app route", () => {
  const shell = readFileSync(join(root, "app/components/admin/AdminShell.tsx"), "utf8");
  assert.match(shell, /Back to app/);
  assert.match(shell, /\/admin\/users/);
  assert.match(shell, /\/admin\/imports/);
  assert.doesNotMatch(shell, /AppShell/);
});

test("global dashboard no longer renders admin and supplier promo cards", () => {
  const dashboard = readFileSync(join(root, "app/(app)/dashboard/page.tsx"), "utf8");
  assert.doesNotMatch(dashboard, /Admin console/);
  assert.doesNotMatch(dashboard, /Supplier workspace/);
});

test("supplier management is admin-only", () => {
  const shell = readFileSync(join(root, "app/components/app/AppShell.tsx"), "utf8");
  const proxy = readFileSync(join(root, "proxy.ts"), "utf8");
  assert.equal(existsSync(join(root, "app/(app)/supplier/page.tsx")), false);
  assert.equal(existsSync(join(root, "app/(admin)/admin/suppliers/page.tsx")), true);
  assert.doesNotMatch(shell, /href: "\/supplier"/);
  assert.doesNotMatch(proxy, /"\/supplier"/);
});
