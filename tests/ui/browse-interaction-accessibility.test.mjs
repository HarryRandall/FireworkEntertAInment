/** Source guards for accessible Explore loading and interactions. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('signed-in Explore navigation keeps truthful stable loading chrome', () => {
  const shell = read('components/shell/AppShell.tsx');

  assert.doesNotMatch(shell, /badge: 'New'/);
  assert.match(shell, /function PendingLibrarySkeleton\(\)[\s\S]*Explore shows/);
  assert.match(shell, /function PendingLibrarySkeleton\(\)[\s\S]*Preview published show templates/);
  assert.match(shell, /aria-busy="true"/);
});

test('Explore shelf controls stay visible and specific during keyboard navigation', () => {
  const row = read('components/explore/ExploreRow.tsx');

  assert.match(row, /aria-label={`Scroll \$\{title\} left`}/);
  assert.match(row, /aria-label={`Scroll \$\{title\} right`}/);
  assert.match(row, /group-focus-within\/row:opacity-100/);
  assert.match(row, /focus-visible:opacity-100/);
  assert.match(row, /focus-visible:ring-2/);
});

test('Explore cards expose their visible facts and retain posters through preview warm-up', () => {
  const card = read('components/explore/ExploreCard.tsx');

  assert.match(card, /aria-labelledby={titleId}/);
  assert.match(card, /aria-describedby={`\$\{durationId\} \$\{themeId\} \$\{statsId\}`}/);
  assert.match(card, /className="sr-only">Duration /);
  assert.match(card, /template\.likeCount === 1 \? 'like' : 'likes'/);
  assert.match(card, /template\.effectsCount === 1 \? 'effect' : 'effects'/);
  assert.match(card, /Estimated retail/);
  assert.match(card, /isPreviewLoading \? 'Loading template preview…' : ''/);
  assert.match(
    card,
    /preview\?\.pendingId === previewId \|\| \(isPreviewActive && !isPreviewRevealed\)/,
  );
  assert.match(card, /isPreviewRevealed \? 'opacity-0' : 'opacity-100'/);
  assert.doesNotMatch(card, /isPreviewHovering/);
});

test('template cloning reports and locks its pending submission', () => {
  const page = read('app/(browse)/library/[id]/page.tsx');
  const submit = read('app/(browse)/library/[id]/CloneTemplateSubmitButton.tsx');

  assert.match(page, /<CloneTemplateSubmitButton \/>/);
  assert.match(submit, /useFormStatus\(\)/);
  assert.match(submit, /disabled={pending}/);
  assert.match(submit, /aria-busy={pending}/);
  assert.match(submit, /pending \? 'Creating…' : 'Create from template'/);
});
