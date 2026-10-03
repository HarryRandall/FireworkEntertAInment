import { fileURLToPath } from 'node:url';
import prettier from 'eslint-config-prettier/flat';
import { readability } from '../../scripts/eslint/readability.mjs';

const packageRoot = fileURLToPath(new URL('.', import.meta.url));

export default [
  { ignores: ['src/schema/design.generated.ts', 'src/templates/index.ts'] },
  ...readability({ files: ['src/**/*.ts', 'tests/**/*.ts'], tsconfigRootDir: packageRoot }),
  {
    files: ['src/sim/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            'node:*',
            'next',
            'next/*',
            'react',
            'react-dom',
            'three',
            'three/*',
            '../view/*',
            '../../view/*',
            '../poster/*',
            '../../poster/*',
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'Date',
        'performance',
        'requestAnimationFrame',
        'crypto',
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use deterministic hash sampling.' },
      ],
    },
  },
  {
    files: ['src/fixtures/**/*.ts', 'tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-magic-numbers': 'off',
      'max-lines': 'off',
      'max-lines-per-function': ['error', { max: 120, skipBlankLines: true, skipComments: true }],
    },
  },
  prettier,
];
