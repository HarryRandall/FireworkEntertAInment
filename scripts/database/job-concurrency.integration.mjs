// Exercise SKIP LOCKED with independent sessions against the fixed local database.
import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { test } from 'node:test';

const executeFile = promisify(execFile);
const psql = process.platform === 'darwin' ? '/opt/homebrew/opt/libpq/bin/psql' : 'psql';
const database = 'postgresql://postgres:postgres@127.0.0.1:55422/postgres';
const psqlArguments = [database, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'];
// A failed child must not leave the database test runner waiting indefinitely.
const childTimeoutMs = 15_000;

async function query(sql) {
  const result = await executeFile(psql, [...psqlArguments, '-c', sql], {
    timeout: childTimeoutMs,
  });
  return result.stdout.trim();
}

function holdClaim(kind) {
  const child = spawn(psql, psqlArguments, { stdio: ['pipe', 'pipe', 'pipe'] });
  let output = '';
  let errors = '';
  let resolveClaim;
  let rejectClaim;
  const claimed = new Promise((resolve, reject) => {
    resolveClaim = resolve;
    rejectClaim = reject;
  });
  const finished = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Concurrent database session failed (${code}): ${errors}`));
    });
  });
  child.stdout.on('data', (chunk) => {
    output += chunk;
    const match = output.match(/[a-f0-9-]{36}/u);
    if (match) resolveClaim(match[0]);
  });
  child.stderr.on('data', (chunk) => {
    errors += chunk;
  });
  child.on('error', rejectClaim);
  const timeout = setTimeout(() => {
    child.kill();
    rejectClaim(new Error('Timed out waiting for a concurrent claim.'));
  }, childTimeoutMs);
  finished.finally(() => clearTimeout(timeout)).catch(rejectClaim);
  child.stdin.write(`begin; set local role service_role;
    select (public.claim_job(array['${kind}'],'worker-a')).id;\n`);
  return { claimed, finished, release: () => child.stdin.end('rollback;\n') };
}

test('concurrent workers claim distinct jobs while the first claim holds its row lock', async () => {
  const kind = `concurrency-${randomUUID()}`;
  const firstJob = randomUUID();
  const secondJob = randomUUID();
  await query(`insert into public.jobs(id,kind,payload) values
    ('${firstJob}','${kind}','{}'),('${secondJob}','${kind}','{}');`);
  let holding;
  try {
    holding = holdClaim(kind);
    // Observe the first result before starting the second session, keeping its lock held.
    const firstClaim = await holding.claimed;
    const secondClaim = await query(`begin; set local role service_role;
      select (public.claim_job(array['${kind}'],'worker-b')).id; rollback;`);
    assert.ok([firstJob, secondJob].includes(firstClaim));
    assert.ok([firstJob, secondJob].includes(secondClaim));
    assert.notEqual(firstClaim, secondClaim);
  } finally {
    try {
      if (holding) {
        holding.release();
        await holding.finished;
      }
    } finally {
      await query(`delete from public.jobs where kind = '${kind}';`);
    }
  }
});
