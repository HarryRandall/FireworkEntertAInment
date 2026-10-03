// Compose pgTAP suites with disposable, pinned Basejump helpers in each transaction.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// SHA-256 of the exact upstream 0.0.6 SQL recorded in the vendor manifest.
const basejumpChecksum = 'abbf1e29994e03d15c7e8c4b0ac7aa33833931e320dbf4f06cab8e842bfe737f';
const extensionGuard =
  '-- complain if script is sourced in psql, rather than via CREATE EXTENSION\n\\echo Use "CREATE EXTENSION supabase_test_helpers" to load this file. \\quit\n';

/** Writes independent, rollback-only SQL suites and returns their absolute paths. */
export function prepareTestSuites(repositoryRoot, outputDirectory) {
  const upstream = readFileSync(
    join(repositoryRoot, 'supabase/vendor/basejump/supabase_test_helpers--0.0.6.sql'),
    'utf8',
  );
  if (createHash('sha256').update(upstream).digest('hex') !== basejumpChecksum) {
    throw new Error('Vendored Basejump SQL differs from the pinned source.');
  }
  if (!upstream.startsWith(extensionGuard)) throw new Error('Unexpected Basejump extension guard.');
  const helpers = readFileSync(join(repositoryRoot, 'supabase/tests/00_helpers.sql'), 'utf8');
  const testNames = readdirSync(join(repositoryRoot, 'supabase/tests'))
    .filter((name) => name.endsWith('.sql') && name !== '00_helpers.sql')
    .sort();
  if (testNames.length === 0) throw new Error('No database suites found.');
  return testNames.map((name) => {
    const suite = readFileSync(join(repositoryRoot, 'supabase/tests', name), 'utf8');
    const path = join(outputDirectory, name);
    writeFileSync(
      path,
      [
        '\\set ON_ERROR_STOP on\nbegin;\nset local search_path = public, extensions;',
        upstream.slice(extensionGuard.length),
        helpers,
        suite,
        'reset role;\nrollback;\n',
      ].join('\n'),
    );
    return path;
  });
}
