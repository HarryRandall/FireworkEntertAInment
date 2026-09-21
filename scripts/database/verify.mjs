import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { databaseTarget, executeSql, query, repositoryRoot } from './runtime.mjs';
import { readSnapshot } from './bootstrap-content.mjs';
import { snapshotTables } from './snapshot.mjs';

try {
  const target = databaseTarget(process.argv.slice(2));
  const snapshot = readSnapshot(join(repositoryRoot, 'supabase/bootstrap'));
  const sql = ['begin read only;'];
  for (const [table] of snapshotTables) {
    const rows = snapshot.tables[table];
    const names = Object.keys(rows[0] ?? {})
      .map((key) => {
        if (!/^[a-z][a-z_0-9]*$/.test(key)) throw new Error('Invalid snapshot column.');
        return `"${key}"`;
      })
      .join(', ');
    const expected = rows.length
      ? `select ${names} from jsonb_populate_recordset(null::public.${table}, '${JSON.stringify(rows).replaceAll("'", "''")}'::jsonb)`
      : `select * from public.${table} where false`;
    const actual = `select ${names || '*'} from public.${table}`;
    sql.push(`do $$ begin
      if exists ((${expected} except all ${actual}) union all (${actual} except all ${expected})) then
        raise exception 'Fresh-install content differs from the snapshot: ${table}';
      end if;
    end $$;`);
  }
  sql.push(
    `do $$ begin
    if not exists (select 1 from private.installation where snapshot_sha256 = '${snapshot.hash}' and media_ready) then
      raise exception 'The installation receipt is missing or media installation is incomplete';
    end if;
    if exists (select 1 from auth.users) or exists (select 1 from public.shows) then
      raise exception 'Run fresh-install verification before adding accounts or local fixtures';
    end if;
  end $$;`,
    'commit;',
  );
  executeSql(target, sql.join('\n'));
  const contract = query(
    target,
    'select public.current_firework_import_renderer_contract_version() as version;',
  )[0]?.version;
  const source = readFileSync(
    join(repositoryRoot, 'apps/web/lib/fireworks/import-renderer-contract.ts'),
    'utf8',
  );
  const version = source.match(
    /showcrafter\.fireworks-engine\.import-renderer\.v1\+sha256\.[a-f0-9]{64}/,
  )?.[0];
  if (!version || version !== contract)
    throw new Error('The installed renderer contract differs from the application.');
  console.log(
    `Verified all ${snapshotTables.length} reusable tables against the snapshot, installation receipt and renderer contract.`,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
