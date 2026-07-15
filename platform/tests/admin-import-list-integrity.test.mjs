/** Focused source guards for admin import-list mutations and feedback. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();
const actions = readFileSync(join(root, 'app/actions/platform-admin.ts'), 'utf8');
const page = readFileSync(join(root, 'app/(admin)/admin/imports/page.tsx'), 'utf8');
const card = readFileSync(join(root, 'app/(admin)/admin/imports/ImportJobCard.tsx'), 'utf8');

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

  for (const [source, affectedRow] of [
    [update, 'updatedJob'],
    [remove, 'deletedJob'],
  ]) {
    assert.match(source, /Promise<ImportJobMutationResult>/);
    assert.match(source, /You do not have permission to manage imports/);
    assert.match(source, /return \{ ok: false, error: firstError\(parsed\.error\) \}/);
    assert.match(source, /\.select\('id'\)\s*\.maybeSingle\(\)/);
    assert.match(source, /if \(!(?:updatedJob|deletedJob)\)/);
    assert.match(source, /return \{ ok: true \}/);

    const databaseErrorGuard = source.indexOf('if (error)');
    const zeroRowGuard = source.indexOf(`if (!${affectedRow})`);
    const invalidation = source.indexOf('invalidateAdminImportsCache');
    const revalidation = source.indexOf("revalidatePath('/admin/imports')");
    assert.ok(
      databaseErrorGuard >= 0 &&
        zeroRowGuard > databaseErrorGuard &&
        invalidation > zeroRowGuard &&
        revalidation > invalidation,
      'cache invalidation and revalidation follow every write failure guard',
    );
  }

  assert.doesNotMatch(update, /created_by/);
  assert.match(update, /Import job could not be saved\. Try again\./);
  assert.match(remove, /Import job could not be deleted\. Try again\./);
});

test('import-list cards provide labelled locked mutations and per-job deletion confirmation', () => {
  assert.match(page, /<ImportJobCard key=\{job\.id\} job=\{job\} \/>/);
  assert.doesNotMatch(page, /updateImportJobAction|deleteImportJobAction/);
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
