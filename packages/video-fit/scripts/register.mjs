/** Transpile the bridge and renderer TypeScript on load, using this package's compiler.
 * The worker image installs only this package and the renderer, not the web app that
 * scripts/renderer/register-typescript.mjs resolves TypeScript from.
 */
import { registerHooks, createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../package.json', import.meta.url));
const ts = require('typescript');

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('.') || specifier.startsWith('file:')) {
      const url = new URL(specifier, context.parentURL);
      if (!existsSync(url) && existsSync(`${fileURLToPath(url)}.ts`)) {
        return next(`${url.href}.ts`, context);
      }
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith('.ts')) {
      const { outputText } = ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
      });
      return { format: 'module', source: outputText, shortCircuit: true };
    }
    return next(url, context);
  },
});
