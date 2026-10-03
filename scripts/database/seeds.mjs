// Generate published catalogue templates through the same transactional authoring RPCs as staff.
import { readFileSync, writeFileSync } from 'node:fs';
import { effectTemplates } from '../../packages/fireworks/src/templates/index.ts';
import { RENDERER_VERSION } from '../../packages/fireworks/src/version.ts';

const path = new URL('../../supabase/seed/20_templates.sql', import.meta.url);
const quote = (value) => `'${value.replaceAll("'", "''")}'`;
const statements = effectTemplates.map(
  (template) =>
    `select public.publish_effect_version(public.create_effect_draft(null, ${quote(template.key)}, ${quote(template.name)}, ${quote(template.group)}, ${quote(JSON.stringify(template.design))}::jsonb, ${quote(RENDERER_VERSION)}));`,
);
const sql = [
  '-- Generated from the canonical effect templates; run pnpm db:seeds to refresh.',
  'begin;',
  `select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}', true);`,
  ...statements,
  // Catalogue presets are reusable starting designs, not ordinary published effects.
  ...effectTemplates.map(
    (template) =>
      `select public.save_effect_details((select id from public.effects where slug = ${quote(template.key)}), ${quote(template.name)}, ${quote(template.group)}, true);`,
  ),
  'commit;\n',
].join('\n');
if (process.argv.length > 3 || (process.argv[2] && process.argv[2] !== '--check')) {
  throw new Error('Use db:seeds or db:seeds --check.');
}
if (process.argv[2] === '--check') {
  if (readFileSync(path, 'utf8') !== sql)
    throw new Error('Template seed has drifted. Run pnpm db:seeds.');
} else writeFileSync(path, sql);
