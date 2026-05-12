import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { join } from "node:path";

const root = process.cwd();

test("RBAC migration keeps role defaults and admin seed", () => {
  const migration = readFileSync(
    join(root, "supabase/migrations/0004_rbac_admin_supplier_foundation.sql"),
    "utf8",
  );
  assert.match(migration, /'admin', 'Admin'/);
  assert.match(migration, /'supplier', 'Supplier'/);
  assert.match(migration, /'user', 'User'/);
  assert.match(migration, /randallhazza@gmail\.com/);
  assert.match(migration, /current_user_has_permission/);
});

test("current profile prefers one RPC call with fallback queries", () => {
  const server = readFileSync(join(root, "lib/admin.server.ts"), "utf8");
  assert.match(server, /\.rpc\(\s*"current_user_access"/);
  assert.match(server, /parseAccessRpc/);
  assert.match(server, /accessError/);
});
