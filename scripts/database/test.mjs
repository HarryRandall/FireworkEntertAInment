import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { executeSql, repositoryRoot, assertSqlTestOutput } from './runtime.mjs';

const directory = join(repositoryRoot, 'supabase/tests');
let failures = 0;
for (const file of readdirSync(directory)
  .filter((name) => name.endsWith('.sql'))
  .sort()) {
  try {
    const output = executeSql({ local: true }, readFileSync(join(directory, file), 'utf8'));
    assertSqlTestOutput(output);
    console.log(`PASS ${file}`);
  } catch (error) {
    failures++;
    console.error(`FAIL ${file}: ${error.message}`);
  }
}
process.exitCode = failures ? 1 : 0;
