import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { join } from "node:path";

const root = process.cwd();
const page = readFileSync(join(root, "app/(app)/shows/new/page.tsx"), "utf8");

test("new show wizard only creates a draft from the final submit", () => {
  const submitGuard = /if \(stepIndex < STEPS\.length - 1\) \{\s+goToStep\(stepIndex \+ 1\);\s+return;\s+\}/s;
  const createCall = page.indexOf("createShowAction(data)");
  const guard = page.search(submitGuard);

  assert.notEqual(guard, -1);
  assert.notEqual(createCall, -1);
  assert.ok(guard < createCall);
});

test("new show wizard keeps navigation controls out of submit flow", () => {
  assert.match(page, /type="button"\s+variant="secondary"/);
  assert.match(page, /type="button"\s+onClick=\{\(\) => goToStep\(stepIndex \+ 1\)\}/);
  assert.match(page, /type="submit"\s+loading=\{isPending\}/);
});

test("new show page avoids redundant chrome", () => {
  assert.doesNotMatch(page, /breadcrumbs=\{/);
  assert.doesNotMatch(page, /Draft details/);
  assert.doesNotMatch(page, /sticky bottom/);
});
