/** Static guard that the contact route does not invent channels or render an inert form. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

test('contact reports the verified beta channel without fabricating public inboxes', () => {
  const source = readFileSync(join(root, 'app/(marketing)/contact/page.tsx'), 'utf8');

  assert.match(source, /There is no monitored ShowCrafter inbox or public contact form today/);
  assert.match(source, /through the same invitation or project channel you received/);
  assert.match(source, /Do not send[\s\S]*passwords[\s\S]*API keys/);
  assert.doesNotMatch(
    source,
    /mailto:|@showcrafter\.app|<form|type="submit"|within one business day|Headquarters/,
  );
});
