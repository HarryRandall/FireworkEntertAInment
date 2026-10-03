/** Generates the checked-in Zod schema and TypeScript types from design.v1.json. */
import { readFile, writeFile } from 'node:fs/promises';
import { jsonSchemaToZod } from 'json-schema-to-zod';
import { format } from 'prettier';

const source = new URL('../schema/design.v1.json', import.meta.url);
const target = new URL('../src/schema/design.generated.ts', import.meta.url);
// Strip annotation defaults before generation: the generator otherwise treats an optional
// property with a default as required even with withoutDefaults enabled.
const schema = JSON.parse(await readFile(source, 'utf8'), (key, value) =>
  key === 'default' ? undefined : value,
);
const definitions = schema.definitions;
const names = new Set(Object.keys(definitions));
const options = {
  withoutDefaults: true,
  withoutDescribes: true,
  parserOverride(node) {
    if (!node.$ref) return;
    const name = node.$ref.replace('#/definitions/', '');
    if (!names.has(name) || node.$ref !== `#/definitions/${name}`) {
      throw new Error(`Unsupported schema reference: ${node.$ref}`);
    }
    return `${name}Schema`;
  },
};

// Emit dependencies first, retaining references rather than duplicating their types.
const emitted = new Set();
let code =
  '// Generated design-schema validators and public types for renderer input validation.\n' +
  '// Generated from schema/design.v1.json; run pnpm generate:schema rather than editing this file.\n';
code += "import { z } from 'zod';\n";
function emit(name) {
  if (emitted.has(name)) return;
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.$ref) emit(node.$ref.replace('#/definitions/', ''));
    for (const value of Object.values(node)) visit(value);
  }
  visit(definitions[name]);
  const generated = jsonSchemaToZod(definitions[name], options);
  const propertyNamePattern = definitions[name].propertyNames?.pattern;
  const validator = propertyNamePattern
    ? `(${generated}).refine((value) => Object.keys(value).every((key) => new RegExp(${JSON.stringify(propertyNamePattern)}).test(key)), { message: 'Unknown adjustment key' })`
    : generated;
  code += `export const ${name}Schema = ${validator};\n`;
  emitted.add(name);
}
for (const name of names) emit(name);
// Root alternatives have distinct literal kinds, so narrowing remains explicit in TypeScript.
code += `export const designSchema = z.discriminatedUnion('kind', [${schema.oneOf
  .map((variant) => jsonSchemaToZod(variant, options))
  .join(',')}]);\n`;
code += 'export type Design = z.infer<typeof designSchema>;\n';
for (const name of names) {
  code += `export type ${name[0].toUpperCase() + name.slice(1)} = z.infer<typeof ${name}Schema>;\n`;
}
if (/z\.(any|unknown)\(/.test(code)) throw new Error('Generator emitted an untyped schema.');
const output = await format(code, { parser: 'typescript', singleQuote: true, printWidth: 100 });
if (process.argv.includes('--check')) {
  if ((await readFile(target, 'utf8')) !== output) {
    throw new Error(
      'Generated design schema is stale. Run pnpm --filter @showcrafter/fireworks generate:schema.',
    );
  }
} else {
  await writeFile(target, output);
}
