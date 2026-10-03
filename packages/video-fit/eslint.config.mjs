import { fileURLToPath } from 'node:url';
import prettier from 'eslint-config-prettier/flat';
import { readability } from '../../scripts/eslint/readability.mjs';

export default [
  ...readability({
    files: ['src/**/*.ts'],
    tsconfigRootDir: fileURLToPath(new URL('.', import.meta.url)),
  }),
  prettier,
];
