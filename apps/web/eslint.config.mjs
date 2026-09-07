import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import architecture from './scripts/eslint-rules.mjs';

const eslintConfig = [
  ...nextVitals,
  ...nextTypescript,
  {
    ignores: ['.next*/**', 'node_modules/**', 'next-env.d.ts'],
  },
  {
    files: ['app/**/*.{ts,tsx}', 'ui/**/*.{ts,tsx}'],
    plugins: { architecture },
    rules: { 'architecture/boundaries': 'error' },
  },
  {
    files: ['ui/patterns/**/*.{ts,tsx}', 'ui/shell/**/*.{ts,tsx}'],
    rules: { 'architecture/semantic-colours': 'error' },
  },
  {
    rules: {
      'react/no-unescaped-entities': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
];

export default eslintConfig;
