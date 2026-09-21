import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { repositoryRoot, supabase } from './runtime.mjs';

try {
  const check = process.argv[2] === '--check';
  if (process.argv.length !== (check ? 3 : 2)) throw new Error('Use db:types or db:types --check.');
  const generated = supabase(['gen', 'types', 'typescript', '--local', '--schema', 'public']);
  const path = join(repositoryRoot, 'apps/web/lib/database.types.ts');
  if (check) {
    if (readFileSync(path, 'utf8').trimEnd() !== generated.trimEnd()) {
      throw new Error(
        'Database types have drifted. Run pnpm db:types after applying your migrations locally.',
      );
    }
    console.log('Generated database types match the local schema.');
  } else {
    writeFileSync(path, generated.trimEnd() + '\n');
    console.log('Updated application types from the local schema.');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
