import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { join } from "node:path";

const root = process.cwd();
const repoRoot = join(root, "..");

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function functionBody(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} not found`);
  const brace = source.indexOf("{", start);
  let depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") depth -= 1;
    if (depth === 0) return source.slice(brace + 1, i);
  }
  throw new Error(`${name} body was not closed`);
}

test("package and root README expose platform-local quality commands", () => {
  const pkg = JSON.parse(read("package.json"));
  const readme = readFileSync(join(repoRoot, "readme.md"), "utf8");
  assert.equal(pkg.type, "module");
  assert.equal(pkg.scripts.typecheck, "tsc --noEmit");
  assert.match(pkg.scripts.check, /npm run lint/);
  assert.match(pkg.scripts.check, /npm run typecheck/);
  assert.match(pkg.scripts.check, /npm test/);
  assert.match(pkg.scripts.check, /npm run build/);
  assert.match(readme, /cd platform/);
  assert.match(readme, /npm run typecheck/);
  assert.match(readme, /npm run check/);
});

test("app and admin routes have granular loading coverage and streaming boundaries", () => {
  for (const path of [
    "app/(app)/dashboard/loading.tsx",
    "app/(app)/library/loading.tsx",
    "app/(app)/settings/loading.tsx",
    "app/(app)/shows/[id]/loading.tsx",
    "app/(app)/shows/[id]/preview/loading.tsx",
    "app/(app)/shows/[id]/shopping-list/loading.tsx",
    "app/(app)/shows/[id]/show-guide/loading.tsx",
    "app/(admin)/admin/loading.tsx",
    "app/(admin)/admin/users/loading.tsx",
    "app/(admin)/admin/users/[id]/loading.tsx",
    "app/(admin)/admin/suppliers/loading.tsx",
    "app/(admin)/admin/catalogue/loading.tsx",
    "app/(admin)/admin/imports/loading.tsx",
    "app/(admin)/admin/imports/[id]/loading.tsx",
    "app/(marketing)/loading.tsx",
  ]) {
    assert.equal(existsSync(join(root, path)), true, `${path} exists`);
  }

  for (const path of [
    "app/(app)/dashboard/page.tsx",
    "app/(app)/library/page.tsx",
    "app/(app)/shows/[id]/preview/page.tsx",
    "app/(app)/shows/[id]/shopping-list/page.tsx",
    "app/(app)/shows/[id]/show-guide/page.tsx",
    "app/(admin)/admin/page.tsx",
    "app/(admin)/admin/users/page.tsx",
    "app/(admin)/admin/suppliers/page.tsx",
    "app/(admin)/admin/catalogue/page.tsx",
    "app/(admin)/admin/imports/page.tsx",
    "app/(admin)/admin/users/[id]/page.tsx",
  ]) {
    assert.match(read(path), /<Suspense\b/, `${path} uses Suspense`);
  }
});

test("three replay canvases are lazy loaded without console warning monkey patches", () => {
  const viewer = read("app/components/app/FireworkReplayViewer.tsx");
  const template = read("app/components/app/TemplateReplayPreview.tsx");
  const importPreview = read("app/(admin)/admin/imports/[id]/FireworkImportPreview.tsx");
  const heroCanvas = read("app/components/marketing/HeroCanvas.tsx");

  assert.match(viewer, /dynamic\(/);
  assert.match(template, /IntersectionObserver/);
  assert.match(template, /shouldMountCanvas/);
  assert.match(importPreview, /dynamic\(/);
  for (const source of [viewer, template, importPreview, heroCanvas]) {
    assert.doesNotMatch(source, /console\.warn\s*=/);
    assert.doesNotMatch(source, /Clock: This module has been deprecated/);
  }
});

test("admin server lists use short TTL cache keys and mutations invalidate them", () => {
  const server = read("lib/admin.server.ts");
  const users = read("app/actions/admin-users.ts");
  const suppliers = read("app/actions/admin-suppliers.ts");
  const catalogue = read("app/actions/admin-catalogue.ts");
  const imports = read("app/actions/platform-admin.ts");

  assert.match(server, /ADMIN_CACHE_TTL_SECONDS = 60/);
  for (const key of [
    "getAdminUsersCacheKey",
    "getAdminSuppliersCacheKey",
    "getAdminCatalogueCacheKey",
    "getAdminImportsCacheKey",
    "getAdminRolesCacheKey",
    "getAdminPermissionsCacheKey",
  ]) {
    assert.match(server, new RegExp(`function ${key}`));
  }
  assert.match(server, /setCachedJson\(cacheKey, mapped, ADMIN_CACHE_TTL_SECONDS\)/);
  assert.match(server, /getAdminUserById[\s\S]*\.from\("profiles"\)[\s\S]*\.eq\("id", userId\)/);
  assert.doesNotMatch(functionBody(server, "getAdminUserById"), /listAdminUsers\(/);

  assert.match(users, /invalidateAdminUsersCache/);
  assert.match(suppliers, /invalidateAdminSuppliersCache/);
  assert.match(catalogue, /invalidateAdminCatalogueCache/);
  assert.match(imports, /invalidateAdminImportsCache/);
  assert.match(imports, /invalidateAdminCatalogueCache/);
});

test("legacy platform-admin user supplier and catalogue actions were removed", () => {
  const actions = read("app/actions/platform-admin.ts");
  for (const symbol of [
    "AdminUserSchema",
    "PermissionOverrideSchema",
    "SupplierSchema",
    "CatalogueProductSchema",
    "updateAdminUserAction",
    "setPermissionOverrideAction",
    "createSupplierAction",
    "updateSupplierAction",
    "deleteSupplierAction",
    "createCatalogueProductAction",
    "updateCatalogueProductAction",
    "deleteCatalogueProductAction",
  ]) {
    assert.doesNotMatch(actions, new RegExp(symbol));
  }
  assert.match(actions, /updateProfileAction/);
  assert.match(actions, /finalizeVideoImportJobAction/);
});

test("admin mutations harden self actions roles supplier URLs and product durations", () => {
  const users = read("app/actions/admin-users.ts");
  const suppliers = read("app/actions/admin-suppliers.ts");
  const catalogue = read("app/actions/admin-catalogue.ts");

  assert.match(users, /You cannot suspend your own account/);
  assert.match(users, /You cannot delete your own account/);
  assert.match(users, /\.from\("roles"\)[\s\S]*\.eq\("id", parsed\.data\.roleId\)/);
  assert.match(suppliers, /url\.protocol === "http:" \|\| url\.protocol === "https:"/);
  assert.match(catalogue, /MAX_PRODUCT_DURATION_SECONDS = 60 \* 60/);
  assert.match(catalogue, /clampProductDurationSeconds/);
});

test("shopping list reads are pure and derived show totals sync only after mutations", () => {
  const shows = read("lib/shows.server.ts");
  const previewActions = read("app/actions/preview-cues.ts");
  const templateActions = read("app/actions/show-templates.ts");
  const listBody = functionBody(shows, "listShoppingItemsForShow");

  assert.doesNotMatch(listBody, /\.update\(/);
  assert.match(shows, /syncShowDerivedFieldsForUser/);
  assert.match(shows, /total_cents: totalCents/);
  assert.match(shows, /effects_count: computed\.effectsCount/);
  assert.match(previewActions, /syncShowDerivedFieldsForUser/);
  assert.match(templateActions, /syncShowDerivedFieldsForUser/);
});

test("firework import worker claims queued jobs atomically", () => {
  const worker = readFileSync(
    join(repoRoot, "workers/firework-import-worker/worker.py"),
    "utf8",
  );
  assert.match(worker, /def claim_queued_job/);
  assert.match(worker, /\.eq\("id", job_id\)\.eq\("status", "queued"\)\.execute\(\)/);
  assert.match(worker, /if not result\.data:/);
  assert.match(worker, /claimed = claim_queued_job\(supabase, job\)/);
});
