import './register-typescript.mjs';
import { query, databaseTarget } from '../database/runtime.mjs';
import {
  convertEmissionDesign,
  convertEmissionPart,
  convertEmissionHistory,
} from './convert-emission-settings.mjs';

// This command is deliberately read-only. Resolve every diagnostic and review
// the output before preparing a guarded, transactional data migration.
const target = databaseTarget(process.argv.slice(2));
const tables = [
  ['firework_effects', 'model_json', convertEmissionDesign],
  ['fireworks', 'render_snapshot_json', convertEmissionDesign],
  ['firework_style_defaults', 'defaults_json', convertEmissionPart],
  ['firework_editor_versions', 'snapshot_json', convertEmissionHistory],
  ['firework_editor_versions', 'previous_snapshot_json', convertEmissionHistory],
];
const report = [];
for (const [table, field, convert] of tables) {
  const rows = query(
    target,
    `select id::text, ${field} as settings from public.${table} order by id`,
  );
  let pending = 0;
  const invalid = [];
  for (const row of rows) {
    try {
      const converted = convert(row.settings);
      if (JSON.stringify(converted) !== JSON.stringify(row.settings)) pending++;
    } catch (error) {
      invalid.push({ id: row.id, error: error.message });
    }
  }
  report.push({ table, field, records: rows.length, pending, invalid });
}
console.log(JSON.stringify({ mode: 'preview', report }, null, 2));
if (report.some((entry) => entry.invalid.length)) process.exitCode = 1;
