/** Static guard that the contact route exposes working channels, not an inert form. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

test('contact directs users to explicit email channels without unsupported claims', () => {
  const source = readFileSync(join(root, 'app/(marketing)/contact/page.tsx'), 'utf8');

  assert.match(source, /mailto:support@showcrafter\.app/);
  assert.match(source, /mailto:partners@showcrafter\.app/);
  assert.match(source, /mailto:press@showcrafter\.app/);
  assert.match(source, /ShowCrafter does not submit messages through this page/);
  assert.doesNotMatch(source, /<form|type="submit"|within one business day|Headquarters/);
});
