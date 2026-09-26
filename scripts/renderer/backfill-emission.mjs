import './register-typescript.mjs';
import { openSync, writeFileSync, fsyncSync, closeSync } from 'node:fs';
import { query, executeSql, databaseTarget } from '../database/runtime.mjs';
import {
  emissionSnapshotQuery,
  emissionTables,
  planEmissionBackfill,
  emissionBackfillStatements,
} from './emission-backfill-plan.mjs';

const args = process.argv.slice(2);
const applyIndex = args.indexOf('--apply');
const apply = applyIndex !== -1;
if (apply) args.splice(applyIndex, 1);
const backupIndex = args.indexOf('--backup');
const backup = backupIndex === -1 ? null : args.splice(backupIndex, 2)[1];
if (apply && !backup) throw new Error('Applying requires --backup <new private file>.');
if (!apply && backup) throw new Error('--backup is only used with --apply. Preview never writes.');
const target = databaseTarget(args);
function read() {
  return Object.fromEntries(
    query(target, emissionSnapshotQuery).map((row) => [row.table_name, row.rows]),
  );
}
const plan = planEmissionBackfill(read());
console.log(
  JSON.stringify(
    {
      mode: apply ? 'apply' : 'preview',
      tables: emissionTables.map((table) => ({
        table,
        records: plan.originals[table].length,
        pending: plan.updates.filter((update) => update.table === table).length,
      })),
      invalid: plan.invalid,
    },
    null,
    2,
  ),
);
if (plan.invalid.length) throw new Error('Backfill stopped. Resolve all conversion diagnostics.');
if (apply && plan.updates.length) {
  // Preserve the exact originals before any write. Never overwrite an earlier
  // backup. Keep the file in an ignored private directory, outside Git.
  const fd = openSync(backup, 'wx', 0o600);
  try {
    writeFileSync(
      fd,
      JSON.stringify({ target, createdAt: new Date().toISOString(), ...plan }, null, 2) + '\n',
    );
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  executeSql(target, `begin;\n${emissionBackfillStatements(plan)}\ncommit;`);
  const verification = planEmissionBackfill(read());
  if (verification.invalid.length || verification.updates.length)
    throw new Error(
      'Conversion committed, but verification requires review. Original data is in the backup.',
    );
  console.log(
    `Converted ${plan.updates.length} records and verified no remaining changes. Original data is in ${backup}.`,
  );
}
