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
  assert.match(worker, /FireworkEffectSpecV3/);
  assert.match(worker, /observations/);
  assert.match(worker, /effectSpec\.shots/);
  assert.match(worker, /libx264/);
  assert.match(worker, /normalizedPreview/);
  assert.match(worker, /DEFAULT_MODEL = os\.getenv\("DEFAULT_OPENROUTER_MODEL", "openai\/gpt-4\.1"\)/);
  assert.doesNotMatch(worker, /gemini/i);
});

test("generated import specs keep inferred renderer mapping fields", () => {
  const imports = readFileSync(join(root, "lib/import-jobs.ts"), "utf8");
  const actions = readFileSync(join(root, "app/actions/platform-admin.ts"), "utf8");
  const worker = readFileSync(
    join(repoRoot, "workers/firework-import-worker/worker.py"),
    "utf8",
  );

  assert.match(imports, /normalizeImportedFireworkSpecInput/);
  assert.match(imports, /effectSpec/);
  assert.match(imports, /fireworkSpecFromEffectSpec/);
  assert.match(imports, /colorPalette/);
  assert.match(imports, /shotsFromEffectSpec/);
  assert.match(imports, /liftTimeSeconds/);
  assert.match(imports, /normalizeImportedFireworkLaunchInput/);
  assert.match(imports, /sparkSpeed:\s*sparkSpeed == null \? value\.sparkSpeed : clamp\(sparkSpeed, 0, 5\)/);
  assert.match(imports, /heightMeters: imported\.heightMeters \?\? null/);
  assert.match(actions, /height_meters: spec\.heightMeters \?\? null/);
  assert.match(worker, /normalized\["heightMeters"\]/);
  assert.match(worker, /Red Green and Blue/);
  assert.match(worker, /Silver tail to Red/);
});

test("upload form bypasses Vercel Server Action body cap with direct-to-storage upload", () => {
  const form = readFileSync(
    join(root, "app/(admin)/admin/imports/VideoImportUploadForm.tsx"),
    "utf8",
  );
  // Regression: Vercel caps Server Action request bodies at 4.5 MB, so the
  // file is uploaded straight from the browser to Supabase Storage and only
  // metadata (storage path, name, size, mime) is posted to the server action.
  assert.match(form, /createSupabaseBrowserClient|@\/utils\/supabase\/client/);
  assert.match(form, /supabase\.storage\s*\.from\(IMPORT_VIDEO_BUCKET\)/);
  assert.match(form, /finalizeVideoImportJobAction/);
  assert.match(form, /name="storagePath"/);
  // Clear the file input before requestSubmit so the bytes don't get
  // re-included in the Server Action POST and trip Vercel's 4.5 MB cap.
  assert.match(form, /fileRef\.current\.value = ""/);
  // Browser couldn't-decode-metadata stays a non-blocking notice.
  assert.match(form, /setNotice\(/);
  assert.match(form, /worker will probe/i);
  assert.match(form, /looksLikeVideoByName/);
});

test("finalize action validates uploaded object lives under caller's admin folder", () => {
  const actions = readFileSync(join(root, "app/actions/platform-admin.ts"), "utf8");
  assert.match(actions, /finalizeVideoImportJobAction/);
  assert.match(actions, /FinalizeVideoImportSchema/);
  // Path-prefix check stops a caller from finalizing someone else's upload.
  assert.match(actions, /verifyCallerOwnedUploadObject/);
  assert.match(actions, /storagePath\.startsWith\(`\$\{adminId\}\/`\)/);
  assert.match(actions, /\.storage\s*\.from\(IMPORT_VIDEO_BUCKET\)\s*\.list/);
  // Storage errors are surfaced verbatim rather than always blamed on
  // the migration not being applied.
  assert.match(actions, /mediaError\?\.message/);
  assert.match(actions, /jobError\?\.message/);
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
