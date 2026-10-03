// Run transaction-isolated pgTAP suites against this checkout's local Supabase only.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareTestSuites } from './test-suite.mjs';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const outputDirectory = mkdtempSync(join(tmpdir(), 'showcrafter-pgtap-'));
try {
  if (process.argv.length !== 2) throw new Error('Database tests accept no destination overrides.');
  const paths = prepareTestSuites(repositoryRoot, outputDirectory);
  const result = spawnSync('pnpm', ['exec', 'supabase', 'test', 'db', '--local', ...paths], {
    cwd: repositoryRoot,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  rmSync(outputDirectory, { recursive: true, force: true });
}
