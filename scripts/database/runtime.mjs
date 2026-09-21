import { spawnSync } from 'node:child_process';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));

export function supabase(args) {
  const result = spawnSync('pnpm', ['exec', 'supabase', ...args], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    // Neither query output nor status output is safe to echo unconditionally.
    throw new Error(
      `Supabase ${args.slice(0, 2).join(' ')} failed. Check the project connection and database logs.`,
    );
  }
  return result.stdout;
}

export function databaseTarget(args) {
  if (args.length === 1 && args[0] === '--local') {
    return { local: true, flags: ['--local'] };
  }
  if (args.length === 2 && args[0] === '--project-ref' && /^[a-z]{20}$/.test(args[1])) {
    const linked = readFileSync(join(repositoryRoot, 'supabase/.temp/project-ref'), 'utf8').trim();
    if (linked !== args[1])
      throw new Error('The linked project does not match the explicit target.');
    return { local: false, projectRef: args[1], flags: ['--linked'] };
  }
  throw new Error('Specify --local or --project-ref <linked-project-ref>.');
}

export function query(target, sql) {
  const directory = mkdtempSync(join(tmpdir(), 'showcrafter-sql-'));
  const path = join(directory, 'query.sql');
  try {
    writeFileSync(path, sql, { mode: 0o600 });
    const output = supabase(['db', 'query', ...target.flags, '--file', path, '--output', 'json']);
    return output.trim() ? (JSON.parse(output).rows ?? []) : [];
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

/** The local CLI query command prepares one statement; psql runs transactional SQL files. */
export function executeSql(target, sql) {
  if (!target.local) {
    const directory = mkdtempSync(join(tmpdir(), 'showcrafter-sql-'));
    try {
      const path = join(directory, 'query.sql');
      writeFileSync(path, sql, { mode: 0o600 });
      supabase(['db', 'query', ...target.flags, '--file', path]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
    return;
  }
  const result = spawnSync(
    'docker',
    [
      'exec',
      '-i',
      'supabase_db_showcrafter',
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    {
      cwd: repositoryRoot,
      input: sql,
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const error = result.stderr.split('\n').find((line) => line.startsWith('ERROR:'));
    throw new Error(error || 'Local SQL execution failed. Check Docker and the database logs.');
  }
}

export function storageCredentials(target) {
  if (target.local) {
    const status = JSON.parse(supabase(['status', '--output', 'json']));
    if (status.API_URL !== 'http://127.0.0.1:55421' || !status.SERVICE_ROLE_KEY) {
      throw new Error('Expected the ShowCrafter local API on port 55421.');
    }
    return { url: status.API_URL, key: status.SERVICE_ROLE_KEY };
  }
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (url !== `https://${target.projectRef}.supabase.co` || !key) {
    throw new Error(
      'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for the explicit destination project.',
    );
  }
  return { url, key };
}
