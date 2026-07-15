/** Static guard for the shared button's disabled and loading interaction contract. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const source = readFileSync(join(process.cwd(), 'app/components/ui/Button.tsx'), 'utf8');

test('shared button owns its interactive link behaviour on the client', () => {
  assert.match(source, /^'use client';/);
});

test('loading links block pointer and keyboard click activation', () => {
  assert.match(source, /const isDisabled = loading \|\| ariaDisabled === true/);
  assert.match(source, /aria-disabled=\{isDisabled \|\| undefined\}/);

  const linkClick = source.slice(source.indexOf('onClick={(event) => {'));
  const disabledGuard = linkClick.indexOf('if (isDisabled)');
  const preventNavigation = linkClick.indexOf('event.preventDefault()');
  const normalClick = linkClick.indexOf('onClick?.(event)');

  assert.ok(disabledGuard >= 0);
  assert.ok(preventNavigation > disabledGuard);
  assert.ok(normalClick > preventNavigation);
});

test('loading buttons expose busy state without exposing decorative motion', () => {
  assert.match(source, /aria-busy=\{loading \? true : ariaBusy\}/);
  assert.match(source, /disabled=\{disabled \|\| loading\}/);
  assert.match(source, /<Loader2 aria-hidden/);
  assert.match(source, /motion-reduce:animate-none/);
});
