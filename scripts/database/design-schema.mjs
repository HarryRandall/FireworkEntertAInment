/** Generate immutable database migrations from the renderer's stored design contract. */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { repositoryRoot } from './runtime.mjs';

const SCHEMA_PATH = join(repositoryRoot, 'packages/renderer/schema/design.v1.json');
const MIGRATION_DIRECTORY = join(repositoryRoot, 'supabase/migrations');
const GENERATED_START = '-- BEGIN GENERATED FIREWORK DESIGN SCHEMA';
const GENERATED_END = '-- END GENERATED FIREWORK DESIGN SCHEMA';
const SQL_DELIMITER = '$design_schema$';
const DESIGN_TABLES = ['firework_effects', 'fireworks'];

/** Emit the same SQL bytes for the same schema, without applying authoring defaults. */
export function schemaSql(schema) {
  const json = JSON.stringify(schema, null, 2);
  if (json.includes(SQL_DELIMITER)) throw new Error('Schema contains the SQL delimiter.');
  return `${GENERATED_START}
create or replace function private.firework_design_schema() returns json
language sql immutable parallel safe set search_path = '' as $function$
  select ${SQL_DELIMITER}${json}${SQL_DELIMITER}::json;
$function$;
comment on function private.firework_design_schema() is
  'Renderer v1 JSON Schema generated from packages/renderer/schema/design.v1.json. Defaults are annotations only.';
revoke all on function private.firework_design_schema() from public, anon, authenticated, service_role;
-- Constraint evaluation needs execution; private schema usage stays revoked for API callers.
grant execute on function private.firework_design_schema() to authenticated, service_role;
${GENERATED_END}`;
}

/** Compare the latest installed helper definition, leaving earlier migrations immutable. */
export function assertCurrentSchema(migrations, schema) {
  const latest = migrations.filter((sql) => sql.includes(GENERATED_START)).at(-1);
  const block = latest?.slice(
    latest.indexOf(GENERATED_START),
    latest.indexOf(GENERATED_END) + GENERATED_END.length,
  );
  if (block !== schemaSql(schema)) {
    throw new Error(
      'Database design schema is stale. Run pnpm db:design-schema --migration <new-timestamp>.',
    );
  }
}

/** Revalidate stored rows whenever a new migration replaces the immutable schema helper. */
function constraintSql() {
  return DESIGN_TABLES.map(
    (table) => `alter table public.${table} drop constraint ${table}_design_valid;
alter table public.${table} add constraint ${table}_design_valid
  check (design is null or extensions.jsonb_matches_schema(private.firework_design_schema(), design));`,
  ).join('\n');
}

function main() {
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
  const files = readdirSync(MIGRATION_DIRECTORY)
    .filter((file) => /^\d{14}_.*\.sql$/.test(file))
    .sort();
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--check') {
    assertCurrentSchema(
      files.map((file) => readFileSync(join(MIGRATION_DIRECTORY, file), 'utf8')),
      schema,
    );
    console.log('Database design schema matches the renderer JSON Schema.');
  } else if (args.length === 2 && args[0] === '--migration' && /^\d{14}$/.test(args[1])) {
    const timestamp = args[1];
    if (timestamp <= files.at(-1).slice(0, 14))
      throw new Error('Use a timestamp after the latest migration.');
    const file = `${timestamp}_firework_design_schema.sql`;
    writeFileSync(
      join(MIGRATION_DIRECTORY, file),
      `begin;\n\n${schemaSql(schema)}\n\n${constraintSql()}\n\ncommit;\n`,
      { flag: 'wx' },
    );
    console.log(
      `Generated supabase/migrations/${file}. Existing designs must pass the updated contract.`,
    );
  } else {
    throw new Error(
      'Use db:design-schema --check or db:design-schema --migration <YYYYMMDDHHMMSS>.',
    );
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
