// Generate structural Zod validators from the checked-in Python analysis schema.
import { readFile, writeFile } from 'node:fs/promises';
import { jsonSchemaToZod } from 'json-schema-to-zod';
import { format } from 'prettier';

const source = new URL('../schema/music-analysis.v1.json', import.meta.url);
const target = new URL('../src/music/analysis.generated.ts', import.meta.url);
// Annotation defaults must not turn optional producer fields into required fields.
const schema = JSON.parse(await readFile(source, 'utf8'), (key, value) =>
  key === 'default' ? undefined : value,
);
const emitted = new Set();
const options = {
  withoutDefaults: true,
  withoutDescribes: true,
  parserOverride(node) {
    if (!node.$ref) return;
    const name = node.$ref.replace('#/$defs/', '');
    if (!schema.$defs[name]) throw new Error(`Unknown analysis reference: ${node.$ref}`);
    return `${name}Schema`;
  },
};
let code = '// Generated music analysis structure from schema/music-analysis.v1.json.\n';
code += "import { z } from 'zod';\n";
function emit(name) {
  if (emitted.has(name)) return;
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (value.$ref) emit(value.$ref.replace('#/$defs/', ''));
    for (const child of Object.values(value)) visit(child);
  }
  visit(schema.$defs[name]);
  code += `const ${name}Schema = ${jsonSchemaToZod(schema.$defs[name], options)};\n`;
  emitted.add(name);
}
for (const name of Object.keys(schema.$defs)) emit(name);
code += `export const analysisStructureSchema = ${jsonSchemaToZod(schema, options)};\n`;
// Pydantic rejects non-finite values; JSON Schema number bounds alone do not.
code = code.replaceAll('z.number()', 'z.number().finite()');
const output = await format(code, { parser: 'typescript', singleQuote: true, printWidth: 100 });
if (/z\.(any|unknown)\(/.test(output)) throw new Error('Untyped analysis schema generated');
if (process.argv.includes('--check')) {
  if ((await readFile(target, 'utf8')) !== output) throw new Error('Music schema has drifted');
} else {
  await writeFile(target, output);
}
