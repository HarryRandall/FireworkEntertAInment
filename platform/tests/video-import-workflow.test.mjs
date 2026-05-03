import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { join } from "node:path";
import { getPreferredImportVideoSource } from "../lib/import-video-preview.js";

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
  assert.match(worker, /FireworkEffectSpecV2/);
  assert.match(worker, /observations/);
  assert.match(worker, /shotSequence/);
  assert.match(worker, /libx264/);
  assert.match(worker, /normalizedPreview/);
});

test("upload action accepts video files when browser leaves file.type empty", () => {
  const actions = readFileSync(join(root, "app/actions/platform-admin.ts"), "utf8");
  // Regression: MPEG-4 SP MP4s were rejected because file.type sometimes comes
  // back empty in Chromium on Linux, so we now also accept by extension.
  assert.match(actions, /looksLikeVideoByName/);
  assert.match(actions, /\\\.\(mp4\|m4v\|mov\|webm\|mkv\)\$/);
  // Inferred content type lets the storage upload satisfy allowed_mime_types
  // even when the browser didn't supply a mime.
  assert.match(actions, /inferredContentType/);
  // Storage upload errors are surfaced verbatim rather than always blamed on
  // the migration not being applied.
  assert.match(actions, /Video upload failed: \$\{detail\}/);
});

test("upload form does not block submission when metadata cannot be decoded", () => {
  const form = readFileSync(
    join(root, "app/(admin)/admin/imports/VideoImportUploadForm.tsx"),
    "utf8",
  );
  // The previous implementation set a hard error in onerror, disabling the
  // submit button for any file Chromium couldn't decode (e.g. MPEG-4 SP).
  // Now onerror sets a non-blocking notice and the worker probes server-side.
  assert.match(form, /setNotice\(/);
  assert.doesNotMatch(form, /onerror = \(\) => \{\s*URL\.revokeObjectURL\(objectUrl\);\s*setError\(/);
  assert.match(form, /worker will probe/i);
  // Filename-based fallback so files without file.type still pass the gate.
  assert.match(form, /looksLikeVideoByName/);
});

test("import detail page polls for live progress without manual refresh", () => {
  const detailPage = readFileSync(
    join(root, "app/(admin)/admin/imports/[id]/page.tsx"),
    "utf8",
  );
  const watcher = readFileSync(
    join(root, "app/(admin)/admin/imports/[id]/ImportProgressWatcher.tsx"),
    "utf8",
  );
  const statusRoute = readFileSync(
    join(root, "app/api/admin/imports/[id]/status/route.ts"),
    "utf8",
  );
  assert.match(detailPage, /ImportProgressWatcher/);
  assert.match(watcher, /"use client"/);
  assert.match(watcher, /\/api\/admin\/imports\/\$\{jobId\}\/status/);
  assert.match(watcher, /router\.refresh\(\)/);
  assert.match(watcher, /TERMINAL_STATUSES/);
  assert.match(statusRoute, /requirePermission\("admin\.manage_imports"\)/);
  assert.match(statusRoute, /processing_progress/);
  assert.match(statusRoute, /import_outputs/);
});

test("import preview prefers a normalized browser-safe asset when present", () => {
  const preferred = getPreferredImportVideoSource({
    storagePath: "admin/original-upload.mp4",
    mimeType: "video/mp4",
    metadata: {
      normalizedPreview: {
        storagePath: "admin/original-upload-browser-h264.mp4",
        mimeType: "video/mp4",
      },
    },
  });
  assert.deepEqual(preferred, {
    storagePath: "admin/original-upload-browser-h264.mp4",
    mimeType: "video/mp4",
  });

  const fallback = getPreferredImportVideoSource({
    storagePath: "admin/original-upload.mp4",
    mimeType: "video/quicktime",
    metadata: { originalName: "demo.mov" },
  });
  assert.deepEqual(fallback, {
    storagePath: "admin/original-upload.mp4",
    mimeType: "video/quicktime",
  });
});
