import { fileURLToPath } from 'node:url';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';
import { frameworkReadability } from '../../scripts/eslint/readability.mjs';
import architecture from './scripts/eslint-rules.mjs';

const packageRoot = fileURLToPath(new URL('.', import.meta.url));

const eslintConfig = [
  ...nextVitals,
  ...nextTypescript,
  {
    // Generated files: Next type stubs and Supabase types from `pnpm db:types`.
    ignores: ['.next*/**', 'node_modules/**', 'next-env.d.ts', 'lib/database.types.ts'],
  },
  {
    files: ['app/**/*.{ts,tsx}', 'ui/**/*.{ts,tsx}'],
    plugins: { architecture },
    rules: { 'architecture/boundaries': 'error' },
  },
  frameworkReadability({
    files: ['app/**/*.{ts,tsx}', 'ui/**/*.{ts,tsx}', 'lib/**/*.ts', 'hooks/**/*.ts', '*.ts'],
    tsconfigRootDir: packageRoot,
  }),
  {
    files: ['**/*.tsx'],
    rules: {
      'max-lines-per-function': ['error', { max: 100, skipBlankLines: true, skipComments: true }],
      'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ['app/**/*.{ts,tsx}', 'ui/**/*.{ts,tsx}'],
    rules: {
      'architecture/legacy-colours': 'error',
      'architecture/semantic-colours': 'error',
    },
  },
  {
    rules: {
      'react/no-unescaped-entities': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    files: ['ui/primitives/**'],
    // Registry files stay close to upstream; all other readability and safety rules still apply.
    rules: { 'readability/export-doc': 'off' },
  },
  prettier,
];

export default eslintConfig;
