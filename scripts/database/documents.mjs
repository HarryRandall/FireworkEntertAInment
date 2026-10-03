// Embed the canonical JSON documents in SQL and keep the declarative baseline in step.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const arguments_ = process.argv.slice(2);
if (arguments_.length > 1 || (arguments_.length === 1 && arguments_[0] !== '--check')) {
  throw new Error('Use db:documents or db:documents --check.');
}
const check = arguments_[0] === '--check';
const files = [
  '00_extensions.sql',
  '01_private_helpers.sql',
  '10_markets.sql',
  '20_people.sql',
  '30_fireworks.sql',
  '31_catalogue.sql',
  '32_imports.sql',
  '40_range.sql',
  '50_shows_qr.sql',
];
const schemaSources = {
  design: 'packages/fireworks/schema/design.v1.json',
  composition: 'supabase/documents/composition.v1.json',
  cues: 'supabase/documents/cues.v1.json',
};

function synchronise(path, expected) {
  const current = readFileSync(path, 'utf8');
  if (current === expected) return;
  if (check) throw new Error(`Generated SQL has drifted: ${path}`);
  writeFileSync(path, expected);
}

for (const [name, source] of Object.entries(schemaSources)) {
  const path = join(
    root,
    'supabase/schemas',
    { design: '30_fireworks.sql', composition: '31_catalogue.sql', cues: '50_shows_qr.sql' }[name],
  );
  const schema = JSON.stringify(JSON.parse(readFileSync(join(root, source), 'utf8')));
  const start = `-- BEGIN GENERATED ${name.toUpperCase()} SCHEMA`;
  const end = `-- END GENERATED ${name.toUpperCase()} SCHEMA`;
  const sql = readFileSync(path, 'utf8');
  const before = sql.indexOf(start);
  const after = sql.indexOf(end);
  if (before < 0 || after < before) throw new Error(`Missing generation markers in ${path}`);
  const generated = `${start}\n-- Generated from ${source}; use pnpm db:documents to refresh.\ncreate or replace function private.${name}_schema()\nreturns json\nlanguage sql\nimmutable\nset search_path = ''\nas $function$\n  select $schema$${schema}$schema$::json;\n$function$;\ncomment on function private.${name}_schema() is 'Returns the canonical v1 JSON Schema for database document validation.';\n${end}`;
  synchronise(path, sql.slice(0, before) + generated + sql.slice(after + end.length));
}
const baseline =
  files
    .map((name) => readFileSync(join(root, 'supabase/schemas', name), 'utf8').trimEnd())
    .join('\n\n') + '\n';
synchronise(join(root, 'supabase/migrations/20261003000000_foundations.sql'), baseline);
console.log(
  check
    ? 'Document schemas and baseline match their sources.'
    : 'Refreshed document schemas and baseline.',
);
