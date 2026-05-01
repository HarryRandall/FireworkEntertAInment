import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { join } from "node:path";

const root = process.cwd();
const repoRoot = join(root, "..");

test("video import workflow has additive schema support", () => {
  const migration = readFileSync(
    join(root, "supabase/migrations/0008_video_firework_imports.sql"),
    "utf8",
  );
  assert.match(migration, /import-videos/);
  assert.match(migration, /selected_model/);
  assert.match(migration, /processing_progress/);
  assert.match(migration, /firework_specification_id/);
  assert.match(migration, /generated_spec/);
  assert.match(migration, /draft_spec/);
});

test("admin imports expose upload, review, refinement, and approval actions", () => {
  const actions = readFileSync(join(root, "app/actions/platform-admin.ts"), "utf8");
  const listPage = readFileSync(join(root, "app/(admin)/admin/imports/page.tsx"), "utf8");
  const detailPage = readFileSync(join(root, "app/(admin)/admin/imports/[id]/page.tsx"), "utf8");
  assert.match(actions, /createVideoImportJobAction/);
  assert.match(actions, /queueImportJobAction/);
  assert.match(actions, /requestImportRefinementAction/);
  assert.match(actions, /approveImportJobAction/);
  assert.match(listPage, /VideoImportUploadForm/);
  assert.match(detailPage, /FireworkImportPreview/);
  assert.match(detailPage, /Approve to catalogue/);
});

test("container worker exists and calls OpenRouter JSON mode with schema validation", () => {
  const workerDir = join(repoRoot, "workers/firework-import-worker");
  assert.equal(existsSync(join(workerDir, "Dockerfile")), true);
  assert.equal(existsSync(join(workerDir, "requirements.txt")), true);
  const worker = readFileSync(join(workerDir, "worker.py"), "utf8");
  assert.match(worker, /OPENROUTER_API_KEY/);
  assert.match(worker, /json_object/);
  assert.match(worker, /jsonschema/);
  assert.match(worker, /MAX_DURATION_SECONDS = 60/);
  assert.match(worker, /generated_spec/);
});
