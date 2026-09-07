/** Source guards for saved-template read and interaction integrity. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('saved-template reads and auth checks fail explicitly', () => {
  const templates = read('lib/admin/templates.server.ts');
  const action = read('app/actions/show-preset-likes.ts');

  assert.match(
    templates,
    /get current preset like failed:[\s\S]*throw new Error\('Saved-show state could not be loaded\.'/,
  );
  assert.match(action, /error: userError/);
  assert.match(action, /if \(userError\)[\s\S]*Your account could not be verified/);
});

test('saved-template control updates immediately, rolls back failures, and exposes canonical state', () => {
  const button = read('components/explore/TemplateLikeButton.tsx');

  assert.match(button, /try \{[\s\S]*await toggleShowPresetLikeAction/);
  assert.match(button, /catch \(error\)[\s\S]*toast\.error/);
  assert.match(button, /setLiked\(result\.liked\)/);
  assert.match(button, /setLikeCount\(result\.likeCount\)/);
  assert.match(button, /const optimisticLiked = !previousLiked/);
  assert.match(button, /setLiked\(optimisticLiked\)/);
  assert.match(button, /setLikeCount\(Math\.max\(0, previousCount/);
  assert.match(button, /if \(!result\.ok\) \{[\s\S]*setLiked\(previousLiked\)/);
  assert.match(button, /catch \(error\) \{[\s\S]*setLiked\(previousLiked\)/);
  assert.match(button, /aria-pressed=\{liked\}/);
  assert.match(button, /aria-busy=\{isPending\}/);
  assert.match(button, /likeCount === 1 \? 'save' : 'saves'/);
  assert.doesNotMatch(button, /transition-all/);
});
