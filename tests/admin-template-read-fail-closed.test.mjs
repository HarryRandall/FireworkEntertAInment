/** Source guards for fail-closed admin Explore preset reads. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const source = readFileSync(join(process.cwd(), 'lib/admin/templates.server.ts'), 'utf8');

function functionBody(name, nextName) {
  const start = source.indexOf(`export async function ${name}`);
  const end = nextName ? source.indexOf(`export async function ${nextName}`, start) : source.length;
  assert.ok(start >= 0 && end > start, `${name} has a bounded source section`);
  return source.slice(start, end);
}

test('admin preset list and detail distinguish denial or missing rows from read failures', () => {
  const list = functionBody('listAdminShowPresets', 'getAdminShowPresetById');
  const detail = functionBody('getAdminShowPresetById', 'getShowTemplateBySlug');

  assert.match(list, /requirePermission\('admin\.manage_catalogue'\)\)\) return \[\]/);
  assert.match(list, /throwAdminTemplateReadError\('listAdminShowPresets', error\)/);
  assert.doesNotMatch(list, /if \(error\)[\s\S]*?return \[\]/);

  assert.match(detail, /requirePermission\('admin\.manage_catalogue'\)\)\) return null/);
  assert.match(detail, /throwAdminTemplateReadError\('getAdminShowPresetById', error\)/);
  assert.match(detail, /if \(!data\) return null/);
  assert.ok(
    detail.indexOf('throwAdminTemplateReadError') < detail.indexOf('if (!data) return null'),
    'failed reads are checked before a genuinely missing preset',
  );
});

test('admin import-source reads preserve feature gating but reject every attempted query error', () => {
  const imports = functionBody('listAdminShowPresetImportShows', 'listShowTemplates');

  assert.match(imports, /if \(!service\) return \[\]/);
  assert.match(imports, /error: importedPresetsError/);
  assert.match(imports, /if \(sourceFailures\.length > 0\)/);
  assert.match(imports, /error: usersError/);
  assert.match(imports, /throwAdminTemplateReadError\('listAdminShowPresetImportShows owners'/);
  assert.doesNotMatch(imports, /listImportableGeneratedShows failed:[\s\S]*?return \[\]/);
  assert.doesNotMatch(imports, /list imported preset sources failed:[\s\S]*?return \[\]/);
});
