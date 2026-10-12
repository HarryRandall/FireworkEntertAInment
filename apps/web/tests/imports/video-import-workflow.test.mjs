/** Focused source guards for the versioned firework video reconstruction workflow. */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';
import { getPreferredImportVideoSource } from '../../lib/firework-import/video-preview.js';

const root = process.cwd();
const repoRoot = root;

test('admin imports expose upload, candidate review, refinement, and guarded approval', () => {
  const actions = readFileSync(join(root, 'app/(admin)/admin/imports/actions.ts'), 'utf8');
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

test('container worker measures the video and fits renderer designs without a browser', () => {
  const workerDir = join(repoRoot, '../../services/firework-import-worker');
  assert.equal(existsSync(join(workerDir, 'requirements.txt')), true);
  const worker = readFileSync(join(workerDir, 'worker.py'), 'utf8');
  const modalApp = readFileSync(join(workerDir, 'modal_app.py'), 'utf8');
  const requirements = readFileSync(join(workerDir, 'requirements.txt'), 'utf8');
  assert.match(worker, /OPENROUTER_API_KEY/);
  assert.match(worker, /MAX_DURATION_SECONDS = 60\.0/);
  assert.match(worker, /from measure import EXTRACTOR, measure/);
  assert.match(worker, /fit_proposal/);
  assert.match(worker, /showcrafter\.firework-reconstruction\.v2/);
  assert.match(worker, /libx264/);
  assert.match(worker, /p_normalized_preview/);
  assert.doesNotMatch(requirements, /playwright/i);
  assert.match(requirements, /^cma==/m);
  assert.match(modalApp, /packages\/video-fit/);
  assert.match(modalApp, /memory=4_096/);
  assert.doesNotMatch(modalApp, /ephemeral_disk/);
  for (const retired of ['engine_validation.py', 'reconstruction.py', 'media_analysis.py']) {
    assert.equal(existsSync(join(workerDir, retired)), false, retired);
  }
});

test('worker CI installs FFmpeg before running media tests', () => {
  const workflow = readFileSync(join(repoRoot, '../../.github/workflows/ci.yml'), 'utf8');
  const workerJob = workflow.split('\n  worker:')[1];
  assert.ok(workerJob);
  assert.match(workerJob, /sudo apt-get install --yes ffmpeg/);
});

test('Modal firework reconstruction starts on demand without scheduled polling', () => {
  const modalApp = readFileSync(
    join(repoRoot, '../../services/firework-import-worker/modal_app.py'),
    'utf8',
  );
  assert.match(modalApp, /reconstruct_run\.spawn\.aio/);
  assert.match(modalApp, /def sweep_queued_runs/);
  assert.doesNotMatch(modalApp, /schedule\s*=\s*modal\./);
});

test('upload form bypasses Vercel Server Action body cap with direct-to-storage upload', () => {
  const form = readFileSync(
    join(root, 'app/(admin)/admin/imports/_components/VideoImportUploadForm.tsx'),
    'utf8',
  );
  // Regression: Vercel caps Server Action request bodies at 4.5 MB, so the
  // file is uploaded straight from the browser to Supabase Storage and only
  // metadata (storage path, name, size, mime) is posted to the server action.
  assert.match(form, /createSupabaseBrowserClient|@\/lib\/supabase\/client/);
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
    join(root, 'app/(admin)/admin/imports/_components/VideoImportUploadForm.tsx'),
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
  const actions = readFileSync(join(root, 'app/(admin)/admin/imports/actions.ts'), 'utf8');
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
    join(root, 'app/(admin)/admin/imports/[id]/_components/ImportProgressWatcher.tsx'),
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

test('import review compares the source with a live show-renderer reconstruction', () => {
  const detailPage = readFileSync(join(root, 'app/(admin)/admin/imports/[id]/page.tsx'), 'utf8');
  const preview = readFileSync(
    join(root, 'app/(admin)/admin/imports/[id]/_components/FireworkImportPreview.tsx'),
    'utf8',
  );
  const actions = readFileSync(join(root, 'app/(admin)/admin/imports/actions.ts'), 'utf8');
  assert.match(preview, /ShowRendererCanvas/);
  assert.doesNotMatch(preview, /FireworkReplayCanvas/);
  assert.match(preview, /firstShotSeconds/);
  assert.match(detailPage, /fit=\{review\.fit\}/);
  assert.doesNotMatch(actions, /seal_firework_import_render_validation/);
  assert.match(actions, /seal_firework_import_candidate/);
  assert.equal(existsSync(join(root, 'app/internal/import-render')), false);
});
