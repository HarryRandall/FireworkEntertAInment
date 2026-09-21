import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import {
  snapshotTables,
  selectSnapshotContent,
  portableRow,
  readTable,
  sha256,
  storageObjectPath,
} from './snapshot.mjs';

async function main() {
  const destination = process.argv[2];
  if (!destination || process.argv.length !== 3) {
    throw new Error(
      'Usage: node --env-file=<source.env> scripts/database/export.mjs <new-directory>',
    );
  }
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (url.protocol !== 'https:' || url.username || url.password || !key) {
    throw new Error('Set the source HTTPS Supabase URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
  // Refuse an existing directory, including a prior incomplete attempt.
  const output = resolve(destination);
  await mkdir(output, { recursive: false });
  let tables = {};
  for (const [table, order] of snapshotTables) {
    tables[table] = await readTable({ url, key, table, order });
    console.log(`${table}: ${tables[table].length} rows`);
  }
  // A second read detects edits across page/table boundaries. This is not a
  // transactional backup: pause catalogue editing for the duration of export.
  for (const [table, order] of snapshotTables) {
    const verify = await readTable({ url, key, table, order });
    if (JSON.stringify(verify) !== JSON.stringify(tables[table])) {
      throw new Error(`${table} changed during export. Stop catalogue edits and retry.`);
    }
  }
  const selection = JSON.parse(
    await readFile(new URL('../../supabase/bootstrap-selection.json', import.meta.url), 'utf8'),
  );
  tables = selectSnapshotContent(tables, selection);
  const manifest = {
    format: 1,
    exportedAt: new Date().toISOString(),
    sourceHost: url.hostname,
    selection,
    tables: {},
    media: [],
  };
  for (const [table] of snapshotTables) {
    const content =
      JSON.stringify(
        tables[table].map((row) => portableRow(table, row)),
        null,
        2,
      ) + '\n';
    await writeFile(join(output, `${table}.json`), content, { flag: 'wx', mode: 0o600 });
    manifest.tables[table] = { rows: tables[table].length, sha256: sha256(content) };
  }
  const objects = [
    ...[...new Set(tables.firework_preview_images.map((row) => row.storage_path).filter(Boolean))]
      .sort()
      .map((path) => ({ bucket: 'firework-previews', path })),
    ...[...new Set(tables.show_presets.map((row) => row.cover_image_path).filter(Boolean))]
      .sort()
      .map((path) => ({ bucket: 'covers', path })),
  ];
  await mkdir(join(output, 'media'));
  for (const { bucket, path } of objects) {
    const encoded = storageObjectPath(path);
    const response = await fetch(
      new URL(`/storage/v1/object/authenticated/${bucket}/${encoded}`, url),
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(30_000),
        redirect: 'error',
      },
    );
    if (!response.ok) throw new Error(`Could not export a preview image: HTTP ${response.status}.`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const digest = sha256(bytes);
    // Hash names prevent object paths from escaping the local destination.
    const filename = `media/${digest}`;
    await writeFile(join(output, filename), bytes, { mode: 0o600 });
    manifest.media.push({
      bucket,
      path,
      file: filename,
      sha256: digest,
      bytes: bytes.length,
      contentType: response.headers.get('content-type'),
    });
  }
  // The manifest is the completion marker and is written only after every asset succeeds.
  await writeFile(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', {
    flag: 'wx',
    mode: 0o600,
  });
  console.log(`Complete snapshot: ${output}. Review content before adding it to version control.`);
}

main().catch((error) => {
  // Do not echo HTTP bodies or request objects, which can contain source data or credentials.
  console.error(
    error instanceof TypeError ? 'Invalid source configuration or network failure.' : error.message,
  );
  process.exitCode = 1;
});
