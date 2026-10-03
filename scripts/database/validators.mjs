// Generate application validators from the canonical database document schemas.
import { readFileSync, writeFileSync } from 'node:fs';
import { jsonSchemaToZod } from 'json-schema-to-zod';
import { format } from 'prettier';

if (process.argv.length > 3 || (process.argv[2] && process.argv[2] !== '--check')) {
  throw new Error('Use db:validators or db:validators --check.');
}
for (const name of ['composition', 'cues']) {
  const source = new URL(`../../supabase/documents/${name}.v1.json`, import.meta.url);
  const target = new URL(`../../apps/web/lib/documents/${name}.generated.ts`, import.meta.url);
  const schema = JSON.parse(readFileSync(source, 'utf8'));
  const validator = jsonSchemaToZod(schema, { withoutDefaults: true, withoutDescribes: true });
  if (/z\.(any|unknown)\(/.test(validator))
    throw new Error('Generator emitted an untyped validator.');
  const code = await format(
    `// Generated from supabase/documents/${name}.v1.json; run pnpm db:validators.\n` +
      `import { z } from 'zod';\nexport const ${name}Schema = ${validator};\n` +
      `export type ${name[0].toUpperCase() + name.slice(1)} = z.infer<typeof ${name}Schema>;\n`,
    { parser: 'typescript', singleQuote: true, printWidth: 100 },
  );
  if (process.argv[2] === '--check') {
    if (readFileSync(target, 'utf8') !== code)
      throw new Error(`Generated ${name} validator has drifted.`);
  } else writeFileSync(target, code);
}
