/** Focused source guards for admin import-list mutations and feedback. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();
const actions = readFileSync(join(root, 'app/actions/platform-admin.ts'), 'utf8');
const page = readFileSync(join(root, 'app/(admin)/admin/imports/page.tsx'), 'utf8');
const loading = readFileSync(join(root, 'app/(admin)/admin/imports/loading.tsx'), 'utf8');
const card = readFileSync(join(root, 'app/(admin)/admin/imports/ImportJobCard.tsx'), 'utf8');
const detailPage = readFileSync(join(root, 'app/(admin)/admin/imports/[id]/page.tsx'), 'utf8');
const importsServer = readFileSync(join(root, 'lib/admin/imports.server.ts'), 'utf8');
const rowActions = readFileSync(
  join(root, 'app/(admin)/admin/imports/ImportJobRowActions.tsx'),
  'utf8',
);

function actionSource(name, nextName) {
  const start = actions.indexOf(`export async function ${name}`);
  const end = nextName
    ? actions.indexOf(`export async function ${nextName}`, start)
    : actions.length;
  assert.ok(start >= 0, `${name} exists`);
  assert.ok(end > start, `${name} has a bounded source section`);
  return actions.slice(start, end);
}

test('import-list metadata writes return failures and refresh only confirmed rows', () => {
  const update = actionSource('updateImportJobAction', 'deleteImportJobAction');
  const remove = actionSource('deleteImportJobAction');

  assert.match(update, /Promise<ImportJobMutationResult>/);
  assert.match(update, /You do not have permission to manage imports/);
  assert.match(update, /return \{ ok: false, error: firstError\(parsed\.error\) \}/);
  assert.match(update, /Video imports can only be changed through their reconstruction controls/);
  assert.match(update, /\.select\('id'\)\s*\.maybeSingle\(\)/);
  assert.match(update, /if \(!updatedJob\)/);
  assert.match(update, /return \{ ok: true \}/);

  assert.match(remove, /Promise<ImportJobMutationResult>/);
  assert.match(remove, /archive_firework_import_job/);
  assert.match(remove, /job\.kind === 'firework_video'/);
  assert.match(remove, /archiveError\?\.message/);
  assert.match(remove, /\.delete\(\)/);
  assert.match(remove, /if \(!deletedJob\)/);
  assert.match(remove, /return \{ ok: true \}/);

  for (const source of [update, remove]) {
    assert.match(source, /invalidateAdminImportsCache/);
    assert.match(source, /revalidatePath\('\/admin\/imports'\)/);
  }

  assert.doesNotMatch(update, /created_by/);
  assert.match(update, /Import job could not be saved\. Try again\./);
  assert.match(remove, /Import job could not be deleted\. Try again\./);
});

test('video imports are read-only table rows while legacy metadata keeps editable cards', () => {
  assert.match(page, /<h1[\s\S]*Firework imports[\s\S]*<\/h1>/);
  assert.match(loading, /<h1[\s\S]*Firework imports[\s\S]*<\/h1>/);
  assert.match(page, /job\.kind === 'firework_video'/);
  assert.match(page, /job\.kind !== 'firework_video'/);
  assert.match(page, /DataTableShell/);
  assert.match(page, /ImportJobRowActions/);
  assert.match(page, /<ImportJobCard key=\{job\.id\} job=\{job\} readOnly=\{archivedView\} \/>/);
  assert.doesNotMatch(page, /updateImportJobAction|deleteImportJobAction/);
  assert.doesNotMatch(rowActions, /updateImportJobAction/);
  assert.match(rowActions, /deleteImportJobAction/);
  assert.match(rowActions, /mutationLockRef\.current/);
  assert.match(rowActions, /toast\.success\('Import job archived'\)/);
  assert.match(rowActions, /retained for\s+audit/);
  assert.match(rowActions, /<AlertDialog/);
  assert.match(rowActions, /href=\{`\/admin\/imports\/\$\{id\}`\}/);

  assert.match(card, /^'use client';/);
  assert.match(card, /mutationLockRef\.current/);
  assert.match(card, /loading=\{isSaving\}/);
  assert.match(card, /Saving…/);
  assert.match(card, /Deleting…/);
  assert.match(card, /toast\.success\('Import job saved'\)/);
  assert.match(card, /toast\.success\('Import job deleted'\)/);
  assert.match(card, /toast\.error\(result\.error\)/);

  assert.match(card, /htmlFor=\{sourceNameId\}>Source name/);
  assert.match(card, /htmlFor=\{sourceUrlId\}>Source URL/);
  assert.match(card, /htmlFor=\{kindId\}>Kind/);
  assert.match(card, /id=\{kindId\}\s+name="kind"/);
  assert.match(card, /htmlFor=\{statusId\}>Status/);
  assert.match(card, /id=\{statusId\}\s+name="status"/);
  assert.match(card, /htmlFor=\{rowCountId\}>Row count/);

  assert.match(card, /<AlertDialog/);
  assert.match(card, /<AlertDialogTitle>Delete import job\?<\/AlertDialogTitle>/);
  assert.match(card, /\{job\.sourceName\}/);
  assert.match(card, /aria-busy=\{isDeleting\}/);
  assert.match(card, /href=\{`\/admin\/imports\/\$\{job\.id\}`\}/);
  assert.doesNotMatch(card, /formAction=\{deleteImportJobAction\}/);
});

test('archived import records remain reviewable without mutation controls', () => {
  assert.match(importsServer, /listImportJobs\(\s*view: 'active' \| 'archived' = 'active',?\s*\)/);
  assert.match(importsServer, /getAdminImportsCacheKey\(view\)/);
  assert.match(
    importsServer,
    /view === 'archived' \? query\.not\('archived_at', 'is', null\) : query\.is\('archived_at', null\)/,
  );
  assert.match(page, /listImportJobs\(archivedView \? 'archived' : 'active'\)/);
  assert.match(page, /readOnly=\{archivedView\}/);
  assert.match(page, /importViewHref\(resolvedSearchParams, 'archived'\)/);
  assert.match(page, /if \(query\) params\.set\('q', query\)/);
  assert.match(page, /if \(status\) params\.set\('status', status\)/);
  assert.match(page, /searchParams=\{searchParams\}/);

  assert.match(card, /readOnly \|\| mutationLockRef\.current/);
  assert.match(card, /disabled=\{isBusy \|\| readOnly\}/);
  assert.match(card, /Retained for audit\. Editing and deletion are unavailable\./);
  assert.match(detailPage, /href=\{archived \? '\/admin\/imports\?view=archived'/);
  assert.match(detailPage, /Archived imports are read-only audit records/);
  assert.match(detailPage, /\{!archived \? \([\s\S]*<ImportRunControls[\s\S]*<ImportPublishPanel/);
  assert.match(detailPage, /selectionLocked: activeRunInProgress \|\| archived/);
  assert.match(detailPage, /\{!archived \? \(\s*<ImportProgressWatcher/);
  assert.match(detailPage, /retainedEvidenceUrl=\{review\.selectedAttempt\?\.renderedVideoUrl/);
  assert.ok(
    detailPage.indexOf('retainedEvidenceUrl=') < detailPage.indexOf('<ImportRunControls'),
    'archived detail keeps retained evidence outside mutation-only controls',
  );
});
