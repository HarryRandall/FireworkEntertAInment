import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sha256, snapshotTables, storageObjectPath } from './snapshot.mjs';

export function readSnapshot(directory) {
  const manifestBytes = readFileSync(join(directory, 'manifest.json'));
  const manifest = JSON.parse(manifestBytes);
  if (manifest.format !== 1) throw new Error('Unsupported catalogue snapshot format.');
  const tables = {};
  for (const [table] of snapshotTables) {
    const content = readFileSync(join(directory, `${table}.json`));
    if (sha256(content) !== manifest.tables[table]?.sha256) {
      throw new Error(`Snapshot integrity check failed for ${table}.`);
    }
    tables[table] = JSON.parse(content);
    if (!Array.isArray(tables[table]) || tables[table].length !== manifest.tables[table].rows) {
      throw new Error(`Snapshot row count is invalid for ${table}.`);
    }
  }
  for (const media of manifest.media) {
    if (
      !['firework-previews', 'covers'].includes(media.bucket) ||
      !/^media\/[a-f0-9]{64}$/.test(media.file)
    ) {
      throw new Error('Invalid snapshot media entry.');
    }
    storageObjectPath(media.path);
    const bytes = readFileSync(join(directory, media.file));
    if (bytes.length !== media.bytes || sha256(bytes) !== media.sha256) {
      throw new Error('Snapshot integrity check failed for a media object.');
    }
  }
  return { manifest, tables, hash: sha256(manifestBytes) };
}

function identifier(value) {
  if (!/^[a-z][a-z_0-9]*$/.test(value)) throw new Error('Invalid snapshot column name.');
  return `"${value}"`;
}

export function snapshotSql(snapshot) {
  const statements = [
    'begin;',
    'set local standard_conforming_strings = on;',
    'set local search_path = public, extensions;',
    'select pg_advisory_xact_lock(734018210);',
    // This is a fresh-install operation, never a way to replace live catalogue edits.
    `do $$ declare relation record; populated boolean; begin
      for relation in select tablename from pg_tables where schemaname = 'public' loop
        execute format('lock table public.%I in access exclusive mode', relation.tablename);
        execute format('select exists (select 1 from public.%I)', relation.tablename) into populated;
        if populated then raise exception 'Bootstrap requires an empty application database; % already contains data', relation.tablename; end if;
      end loop;
    end $$;`,
  ];
  for (const [table] of snapshotTables) {
    statements.push(`alter table public.${identifier(table)} disable trigger user;`);
  }
  for (const [table] of snapshotTables) {
    const rows = snapshot.tables[table];
    if (!rows.length) continue;
    const columns = Object.keys(rows[0]);
    if (rows.some((row) => Object.keys(row).sort().join() !== [...columns].sort().join())) {
      throw new Error(`Inconsistent row columns in ${table}.`);
    }
    const names = columns.map(identifier).join(', ');
    const json = JSON.stringify(rows).replaceAll("'", "''");
    statements.push(
      `insert into public.${identifier(table)} (${names}) select ${names} from jsonb_populate_recordset(null::public.${identifier(table)}, '${json}'::jsonb);`,
    );
  }
  for (const [table] of snapshotTables) {
    statements.push(`alter table public.${identifier(table)} enable trigger user;`);
  }
  statements.push('select private.assert_all_published_show_presets();');
  statements.push(
    `insert into private.installation (id, snapshot_sha256) values (true, '${snapshot.hash}');`,
  );
  statements.push('commit;');
  return statements.join('\n\n') + '\n';
}
