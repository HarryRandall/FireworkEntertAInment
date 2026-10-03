// Behaviour tests for the repository's local ESLint rules.

import { RuleTester } from 'eslint';
import localRules from './local-rules.mjs';

const ruleTester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } });
const pullRequestReference = [
  '// Added in ',
  'PR',
  ' 9.9 and removed later.\nconst value = 1;',
].join('');
const stageReference = ["test('until ", 'stage', " 9, uses the fallback', () => {});"].join('');
const branchReference = ['// See ', 'rebuild/', 'example-branch.\nconst value = 1;'].join('');

ruleTester.run('readability/export-doc', localRules.rules['export-doc'], {
  valid: [
    '/** Computes the launch time. */\nexport function launchTime() { return 0; }',
    '/** Renders the page. */\nexport default function Page() { return null; }',
    '/** Creates a client. */\nexport const createClient = () => ({});',
    '/** Performs internal work exposed to callers. */\nfunction internalHelper() {}\nexport { internalHelper };',
    '/** Controls the viewer. */\nexport class Viewer {\n/** Starts playback. */\nplay() {}\n}',
    'export const DEFAULT_LIMIT = 10;',
  ],
  invalid: [
    {
      code: 'export function launchTime() { return 0; }',
      errors: [{ messageId: 'missing' }],
    },
    {
      code: '// Module overview.\nexport default function Page() { return null; }',
      errors: [{ messageId: 'missing' }],
    },
    {
      code: 'export const createClient = () => ({});',
      errors: [{ messageId: 'missing' }],
    },
    {
      code: 'function internalHelper() {}\nexport { internalHelper };',
      errors: [{ messageId: 'missing' }],
    },
    {
      code: '/** Controls the viewer. */\nexport class Viewer { play() {} }',
      errors: [{ messageId: 'missing' }],
    },
  ],
});

ruleTester.run('readability/disable-reason', localRules.rules['disable-reason'], {
  valid: [
    '// eslint-disable-next-line max-params -- The scalar kernel avoids allocation.\nrun(a, b);',
    'run(a, b);',
  ],
  invalid: [
    {
      code: '// eslint-disable max-params -- Bounded kernel.\nrun(a, b);',
      errors: [{ messageId: 'broad' }],
    },
    {
      code: '// eslint-disable-next-line max-params\nrun(a, b);',
      errors: [{ messageId: 'reason' }],
    },
  ],
});

ruleTester.run('readability/no-plan-history', localRules.rules['no-plan-history'], {
  valid: [
    '// Vertex shader stage inputs are packed by attribute.',
    "test('renders the current catalogue', () => {});",
  ],
  invalid: [
    {
      code: pullRequestReference,
      errors: [{ messageId: 'reference' }],
    },
    {
      code: stageReference,
      errors: [{ messageId: 'reference' }],
    },
    {
      code: branchReference,
      errors: [{ messageId: 'reference' }],
    },
  ],
});
