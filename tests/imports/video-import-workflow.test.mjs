/** Focused source guards for the versioned firework video reconstruction workflow. */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';
import { getPreferredImportVideoSource } from '../../lib/import-video-preview.js';

const root = process.cwd();
const repoRoot = root;

test('video import workflow has additive schema support', () => {
  const migration = readFileSync(
    join(root, 'supabase/migrations/0008_video_firework_imports.sql'),
    'utf8',
  );
  assert.match(migration, /import-videos/);
  assert.match(migration, /selected_model/);
  assert.match(migration, /processing_progress/);
  assert.match(migration, /firework_specification_id/);
  assert.match(migration, /generated_spec/);
  assert.match(migration, /draft_spec/);
});

test('admin imports expose upload, candidate review, refinement, and guarded approval', () => {
  const actions = readFileSync(join(root, 'app/actions/platform-admin.ts'), 'utf8');
  const listPage = readFileSync(join(root, 'app/(admin)/admin/imports/page.tsx'), 'utf8');
  const detailPage = readFileSync(join(root, 'app/(admin)/admin/imports/[id]/page.tsx'), 'utf8');
  assert.match(actions, /finalizeVideoImportJobAction/);
  assert.match(actions, /queueImportJobAction/);
  assert.match(actions, /requestImportRefinementAction/);
  assert.match(actions, /selectImportCandidateAction/);
  assert.match(actions, /approveImportJobAction/);
  assert.match(listPage, /VideoImportUploadForm/);
  assert.match(detailPage, /FireworkImportPreview/);
  assert.match(detailPage, /ImportCandidatePicker/);
  assert.match(detailPage, /ImportValidationPanel/);
  assert.match(detailPage, /ImportPublishPanel/);
  assert.match(detailPage, /getImportRunHistory/);
  assert.match(detailPage, /activeRunInProgress[\s\S]*Wait for the active reconstruction run/);
  assert.doesNotMatch(detailPage, /job\.status !== 'needs_review'/);
});

test('container worker performs deterministic media analysis and multi-pass model reconstruction', () => {
  const workerDir = join(repoRoot, 'services/firework-import-worker');
  assert.equal(existsSync(join(workerDir, 'Dockerfile')), true);
  assert.equal(existsSync(join(workerDir, 'requirements.txt')), true);
  const worker = readFileSync(join(workerDir, 'worker.py'), 'utf8');
  const reconstruction = readFileSync(join(workerDir, 'reconstruction.py'), 'utf8');
  const mediaAnalysis = readFileSync(join(workerDir, 'media_analysis.py'), 'utf8');
  const modalApp = readFileSync(join(workerDir, 'modal_app.py'), 'utf8');
  assert.match(worker, /OPENROUTER_API_KEY/);
  assert.match(worker, /json_schema/);
  assert.match(worker, /STRICT_IMPORT_SPEC_SCHEMA/);
  assert.match(reconstruction, /jsonschema/);
  assert.match(worker, /MAX_DURATION_SECONDS = 60/);
  assert.match(worker, /generated_spec/);
  assert.match(worker, /FireworkEffectSpecV3/);
  assert.match(worker, /observations/);
  assert.match(worker, /effectSpec\.shots/);
  assert.match(worker, /libx264/);
  assert.match(worker, /normalizedPreview/);
  assert.match(worker, /run_reconstruction_passes/);
  assert.match(worker, /build_renderer_reconstruction/);
  assert.match(worker, /build_reconstruction_validation/);
  assert.match(reconstruction, /candidate_count/);
  assert.match(reconstruction, /pass_count/);
  assert.match(reconstruction, /STRICT_IMPORT_SPEC_SCHEMA/);
  assert.match(mediaAnalysis, /analyse_firework_video/);
  assert.match(mediaAnalysis, /normalisedGravity/);
  assert.match(modalApp, /memory=4_096/);
  assert.doesNotMatch(modalApp, /ephemeral_disk/);
  assert.doesNotMatch(worker, /gemini/i);
});

test('worker CI installs FFmpeg before running media tests', () => {
  const workflow = readFileSync(join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
  const workerJob = workflow.split('\n  worker:')[1];
  assert.ok(workerJob);
  assert.match(workerJob, /sudo apt-get install --yes ffmpeg/);
});

test('Modal firework reconstruction starts on demand without scheduled polling', () => {
  const modalApp = readFileSync(
    join(repoRoot, 'services/firework-import-worker/modal_app.py'),
    'utf8',
  );
  assert.match(modalApp, /reconstruct_run\.spawn\.aio/);
  assert.match(modalApp, /def sweep_queued_runs/);
  assert.doesNotMatch(modalApp, /schedule\s*=\s*modal\./);
});

test('generated import specs preserve native renderer designs and shot observations', () => {
  const imports = readFileSync(join(root, 'lib/import-jobs.ts'), 'utf8');
  const nativeContract = readFileSync(join(root, 'lib/import-reconstruction.ts'), 'utf8');
  const reconstructionMigration = readFileSync(
    join(root, 'supabase/migrations/20260715064431_add_firework_import_reconstruction_runs.sql'),
    'utf8',
  );
  const reconstruction = readFileSync(
    join(repoRoot, 'services/firework-import-worker/reconstruction.py'),
    'utf8',
  );

  assert.match(imports, /normalizeImportedFireworkSpecInput/);
  assert.match(imports, /effectSpec/);
  assert.match(imports, /fireworkSpecFromEffectSpec/);
  assert.match(imports, /colorPalette/);
  assert.match(imports, /shotsFromEffectSpec/);
  assert.match(imports, /liftTimeSeconds/);
  assert.match(imports, /normalizeImportedFireworkLaunchInput/);
  assert.match(
    imports,
    /sparkSpeed:\s*sparkSpeed == null \? value\.sparkSpeed : clamp\(sparkSpeed, 0, 5\)/,
  );
  assert.match(imports, /heightMeters: imported\.heightMeters \?\? null/);
  assert.match(imports, /reconstructionToReplayCues/);
  assert.match(nativeContract, /ReconstructionDesignInputSchema/);
  assert.match(nativeContract, /effectSlug/);
  assert.match(nativeContract, /observedBurstTimeSeconds/);
  assert.match(nativeContract, /observedFadeEndSeconds/);
  assert.match(nativeContract, /sourceTimeOffsetSeconds/);
  assert.match(reconstructionMigration, /'sourceTimeOffsetSeconds'/);
  assert.match(nativeContract, /parseStrictFireworkDesign/);
  assert.match(reconstruction, /build_renderer_reconstruction/);
  assert.match(reconstruction, /normalisedGravity/);
});

test('upload form bypasses Vercel Server Action body cap with direct-to-storage upload', () => {
  const form = readFileSync(
    join(root, 'app/(admin)/admin/imports/VideoImportUploadForm.tsx'),
    'utf8',
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
  assert.match(form, /fileRef\.current\.value = ['"]{2}/);
  // Browser couldn't-decode-metadata stays a non-blocking notice.
  assert.match(form, /setNotice\(/);
  assert.match(form, /worker will probe/i);
  assert.match(form, /looksLikeVideoByName/);
  assert.match(form, /MAX_IMPORT_VIDEO_BYTES = 250 \* 1024 \* 1024/);
  assert.match(form, /Retry finalisation/);
  assert.match(form, /Progress is indeterminate/);
  assert.match(form, /FinalisationCycle/);
  assert.match(form, /finalisationCycle === 'settled'/);
  assert.match(form, /beforeunload/);
  assert.match(form, /videoProbeRef/);
  assert.doesNotMatch(form, /setInterval/);
  const sourceNameControl = form.slice(
    form.indexOf('id="import-source-name"'),
    form.indexOf('/>', form.indexOf('id="import-source-name"')),
  );
  const modelControl = form.slice(
    form.indexOf('name="selectedModel"'),
    form.indexOf('</Select>', form.indexOf('name="selectedModel"')),
  );
  assert.doesNotMatch(sourceNameControl, /disabled=\{busy\}/);
  assert.doesNotMatch(modelControl, /disabled=\{busy\}/);
});

test('uploaded video failure recovery retains exactly one safe retry or discard path', () => {
  const form = readFileSync(
    join(root, 'app/(admin)/admin/imports/VideoImportUploadForm.tsx'),
    'utf8',
  );
  const discardStart = form.indexOf('async function discardUploadedVideo');
  const discardEnd = form.indexOf('const busy', discardStart);
  const discard = form.slice(discardStart, discardEnd);

  assert.match(discard, /\.remove\(\[uploaded\.storagePath\]\)/);
  assert.match(discard, /if \(removeError\) throw new Error\(removeError\.message\)/);
  const removalGuard = discard.indexOf('if (removeError)');
  for (const reset of [
    'setUploaded(null)',
    "setFinalisationCycle('none')",
    'setSelectedFile(null)',
    'setDuration(null)',
    "fileRef.current.value = ''",
  ]) {
    assert.ok(discard.indexOf(reset) > removalGuard, `${reset} follows confirmed Storage removal`);
  }

  assert.match(form, /uploaded && finalisationCycle === 'settled' \? state\.error : null/);
  assert.match(form, /hasFinalizedRef\.current = true/);
  assert.match(form, /if \(uploaded\) \{[\s\S]*setFinalisationCycle\('awaiting-start'\)/);
  assert.match(form, /disabled=\{busy \|\| Boolean\(uploaded\)\}/);
});

test("finalize action validates uploaded object lives under caller's admin folder", () => {
  const actions = readFileSync(join(root, 'app/actions/platform-admin.ts'), 'utf8');
  assert.match(actions, /finalizeVideoImportJobAction/);
  assert.match(actions, /FinalizeVideoImportSchema/);
  // Path-prefix check stops a caller from finalizing someone else's upload.
  assert.match(actions, /verifyCallerOwnedUploadObject/);
  assert.match(actions, /storagePath\.startsWith\(`\$\{adminId\}\/`\)/);
  assert.match(actions, /\.storage\s*\.from\(IMPORT_VIDEO_BUCKET\)\s*\.list/);
  // Finalisation is one guarded database transaction and preserves its error.
  assert.match(actions, /finalise_firework_video_import/);
  assert.match(actions, /error\?\.message \?\? 'Could not create the import job/);
  assert.match(actions, /dispatchFireworkImportRun/);
});

test('import detail page polls for live progress without manual refresh', () => {
  const detailPage = readFileSync(join(root, 'app/(admin)/admin/imports/[id]/page.tsx'), 'utf8');
  const watcher = readFileSync(
    join(root, 'app/(admin)/admin/imports/[id]/ImportProgressWatcher.tsx'),
    'utf8',
  );
  const statusRoute = readFileSync(
    join(root, 'app/api/admin/imports/[id]/status/route.ts'),
    'utf8',
  );
  assert.match(detailPage, /ImportProgressWatcher/);
  assert.match(watcher, /['"]use client['"]/);
  assert.match(watcher, /\/api\/admin\/imports\/\$\{jobId\}\/status/);
  assert.match(watcher, /router\.refresh\(\)/);
  assert.match(watcher, /TERMINAL_STATUSES/);
  assert.match(watcher, /visibilitychange/);
  assert.match(watcher, /MAX_BACKOFF_MS/);
  assert.match(watcher, /candidateCount/);
  assert.match(statusRoute, /requirePermission\(['"]admin\.manage_imports['"]\)/);
  assert.match(statusRoute, /processing_progress/);
  assert.match(statusRoute, /import_outputs/);
  assert.match(statusRoute, /import_run_outputs/);
  assert.match(statusRoute, /import_candidates/);
});

test('import preview prefers a normalized browser-safe asset when present', () => {
  const preferred = getPreferredImportVideoSource({
    storagePath: 'admin/original-upload.mp4',
    mimeType: 'video/mp4',
    metadata: {
      normalizedPreview: {
        storagePath: 'admin/original-upload-browser-h264.mp4',
        mimeType: 'video/mp4',
      },
    },
  });
  assert.deepEqual(preferred, {
    storagePath: 'admin/original-upload-browser-h264.mp4',
    mimeType: 'video/mp4',
  });

  const fallback = getPreferredImportVideoSource({
    storagePath: 'admin/original-upload.mp4',
    mimeType: 'video/quicktime',
    metadata: { originalName: 'demo.mov' },
  });
  assert.deepEqual(fallback, {
    storagePath: 'admin/original-upload.mp4',
    mimeType: 'video/quicktime',
  });
});

test('selected retained engine evidence uses a bounded private URL and accurate UI labels', () => {
  const historyServer = readFileSync(join(root, 'lib/import-review.server.ts'), 'utf8');
  const detailPage = readFileSync(join(root, 'app/(admin)/admin/imports/[id]/page.tsx'), 'utf8');
  const preview = readFileSync(
    join(root, 'app/(admin)/admin/imports/[id]/FireworkImportPreview.tsx'),
    'utf8',
  );
  const validationPanel = readFileSync(
    join(root, 'app/(admin)/admin/imports/[id]/ImportEngineValidationPanel.tsx'),
    'utf8',
  );
  const documentation = readFileSync(
    join(root, 'docs/firework-import-engine-validation.md'),
    'utf8',
  );

  assert.match(historyServer, /RETAINED_EVIDENCE_URL_TTL_SECONDS = 15 \* 60/);
  assert.match(historyServer, /isRunOwnedImportEngineReviewVideoPath/);
  assert.match(historyServer, /\.eq\('import_run_id', selectedCandidate\.import_run_id\)/);
  assert.match(historyServer, /\.eq\('output_type', 'render_metrics'\)/);
  assert.match(historyServer, /\.eq\('storage_path', selectedCandidate\.rendered_video_path\)/);
  assert.match(historyServer, /createSignedRetainedEvidenceUrl/);
  assert.match(historyServer, /renderedVideoUrl:/);
  assert.match(
    detailPage,
    /retainedEvidenceUrl=\{review\.selectedAttempt\?\.renderedVideoUrl \?\? null\}/,
  );
  assert.match(preview, /Retained sampled engine evidence/);
  assert.match(preview, /Live current-engine reconstruction/);
  assert.match(preview, /showFps=\{false\}/);
  assert.match(preview, /not continuous footage or a claim of exact physical recovery/);
  assert.match(validationPanel, /do not claim continuous or\s+exact physical recovery/);
  assert.match(validationPanel, /SHA-256/);
  assert.match(validationPanel, /Storage ETag/);
  assert.match(detailPage, /artifact=\{review\.engineArtifact\}/);
  assert.match(documentation, /For every candidate that meets the engine thresholds/);
  assert.doesNotMatch(documentation, /For the final winner only/);
});
