// Shared typed ESLint policy for handwritten TypeScript across the workspace.

import js from '@eslint/js';
import sonarjs from 'eslint-plugin-sonarjs';
import tsdoc from 'eslint-plugin-tsdoc';
import tseslint from 'typescript-eslint';
import localRules from './local-rules.mjs';

const MAX_COMPLEXITY = 10;
const MAX_COGNITIVE_COMPLEXITY = 15;
const MAX_DEPTH = 3;
const MAX_PARAMETERS = 4;
const MAX_FUNCTION_LINES = 60;
const MAX_MODULE_LINES = 300;

const strictTypeCheckedRules = tseslint.configs.strictTypeChecked.at(-1).rules;

const sharedRules = {
  complexity: ['error', { max: MAX_COMPLEXITY, variant: 'modified' }],
  'max-depth': ['error', MAX_DEPTH],
  'max-params': ['error', MAX_PARAMETERS],
  'max-lines-per-function': [
    'error',
    { max: MAX_FUNCTION_LINES, skipBlankLines: true, skipComments: true },
  ],
  'max-lines': ['error', { max: MAX_MODULE_LINES, skipBlankLines: true, skipComments: true }],
  'one-var': ['error', 'never'],
  curly: ['error', 'all'],
  eqeqeq: ['error', 'always'],
  'no-nested-ternary': 'error',
  'no-magic-numbers': 'off',
  '@typescript-eslint/no-magic-numbers': [
    'error',
    {
      ignore: [-1, 0, 1, 2, 0.5],
      ignoreArrayIndexes: true,
      ignoreDefaultValues: false,
      enforceConst: true,
      detectObjects: true,
      ignoreEnums: true,
      ignoreNumericLiteralTypes: true,
      ignoreReadonlyClassProperties: false,
      ignoreTypeIndexes: true,
    },
  ],
  '@typescript-eslint/consistent-type-imports': [
    'error',
    { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
  ],
  '@typescript-eslint/no-non-null-assertion': 'error',
  '@typescript-eslint/no-floating-promises': ['error', { ignoreVoid: false }],
  '@typescript-eslint/no-misused-promises': 'error',
  '@typescript-eslint/only-throw-error': 'error',
  '@typescript-eslint/switch-exhaustiveness-check': [
    'error',
    { considerDefaultExhaustiveForUnions: false },
  ],
  '@typescript-eslint/strict-boolean-expressions': [
    'error',
    {
      allowString: false,
      allowNumber: false,
      allowNullableObject: true,
      allowNullableBoolean: false,
      allowNullableString: false,
      allowNullableNumber: false,
      allowAny: false,
    },
  ],
  'sonarjs/cognitive-complexity': ['error', MAX_COGNITIVE_COMPLEXITY],
  'sonarjs/no-identical-functions': 'error',
  'tsdoc/syntax': 'error',
  'readability/disable-reason': 'error',
  'readability/export-doc': 'error',
  'readability/no-plan-history': 'error',
};

function commonConfig(files, tsconfigRootDir) {
  return {
    files,
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir } },
    plugins: { sonarjs, tsdoc, readability: localRules },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
      reportUnusedInlineConfigs: 'error',
    },
  };
}

/** Builds the complete typed readability policy for a TypeScript package. */
export function readability({ files, tsconfigRootDir }) {
  return tseslint.config({
    ...commonConfig(files, tsconfigRootDir),
    extends: [js.configs.recommended, ...tseslint.configs.strictTypeChecked],
    rules: sharedRules,
  });
}

/** Adds typed readability rules after a framework has supplied its TypeScript plugin. */
export function frameworkReadability({ files, tsconfigRootDir }) {
  const compatibleStrictRules = { ...strictTypeCheckedRules };
  delete compatibleStrictRules['@typescript-eslint/no-generated-empty-object-type'];
  delete compatibleStrictRules['@typescript-eslint/no-unsafe-enum-assignment'];
  return {
    ...commonConfig(files, tsconfigRootDir),
    rules: { ...compatibleStrictRules, ...sharedRules },
  };
}
