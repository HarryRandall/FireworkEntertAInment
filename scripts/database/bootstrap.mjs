import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readSnapshot, snapshotSql } from './bootstrap-content.mjs';
import { sha256, storageObjectPath } from './snapshot.mjs';
import {
  databaseTarget,
  query,
  executeSql,
  repositoryRoot,
  storageCredentials,
} from './runtime.mjs';

async function main() {
  const target = databaseTarget(process.argv.slice(2));
  const directory = join(repositoryRoot, 'supabase/bootstrap');
  const snapshot = readSnapshot(directory);
  const receipt = query(
    target,
    'select snapshot_sha256, media_ready from private.installation where id = true;',
  )[0];
  if (receipt?.media_ready) {
    console.log(
      'Application content is already installed. Existing catalogue edits were left unchanged.',
    );
    return;
  }
  if (receipt && receipt.snapshot_sha256 !== snapshot.hash) {
    throw new Error(
      'An incomplete installation used a different snapshot. Resume with that original snapshot.',
    );
  }
  const { url, key } = storageCredentials(target);
  if (!receipt) executeSql(target, snapshotSql(snapshot));

  async function upload(media) {
    const endpoint = new URL(
      `/storage/v1/object/${media.bucket}/${storageObjectPath(media.path)}`,
      url,
    );
    const headers = { apikey: key, Authorization: `Bearer ${key}` };
    let existing = await fetch(endpoint, {
      headers,
      signal: AbortSignal.timeout(30_000),
      redirect: 'error',
    });
    if (existing.status === 400 || existing.status === 404) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': media.contentType || 'application/octet-stream',
          'x-upsert': 'false',
        },
        body: readFileSync(join(directory, media.file)),
        signal: AbortSignal.timeout(30_000),
        redirect: 'error',
      });
      if (!response.ok && ![400, 409].includes(response.status)) {
        throw new Error(`Media upload failed: HTTP ${response.status}. Rerun bootstrap to resume.`);
      }
      existing = await fetch(endpoint, {
        headers,
        signal: AbortSignal.timeout(30_000),
        redirect: 'error',
      });
    }
    if (!existing.ok || sha256(Buffer.from(await existing.arrayBuffer())) !== media.sha256) {
      throw new Error(
        'A destination media object is missing or differs from the snapshot. It was not overwritten.',
      );
    }
  }
  for (let offset = 0; offset < snapshot.manifest.media.length; offset += 4) {
    await Promise.all(snapshot.manifest.media.slice(offset, offset + 4).map(upload));
  }
  executeSql(
    target,
    `update private.installation set media_ready = true where id = true and snapshot_sha256 = '${snapshot.hash}';`,
  );
  console.log(
    `Installed ${snapshot.manifest.media.length} verified media objects and the catalogue snapshot. No accounts were copied.`,
  );
}

main().catch((error) => {
  console.error(
    error instanceof TypeError ? 'Bootstrap network or configuration error.' : error.message,
  );
  process.exitCode = 1;
});
