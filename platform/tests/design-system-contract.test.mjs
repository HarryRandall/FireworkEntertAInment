/** Static guards for the ShowCrafter design-system and repository guidance contracts. */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const platformRoot = process.cwd();
const repoRoot = join(platformRoot, '..');

function readPlatform(path) {
  return readFileSync(join(platformRoot, path), 'utf8');
}

function readRepo(path) {
  return readFileSync(join(repoRoot, path), 'utf8');
}

test('agent guidance mirrors stay in sync', () => {
  assert.equal(readRepo('AGENTS.md'), readRepo('CLAUDE.md'));
  assert.equal(
    readRepo('.agents/skills/showcrafter-design-system/SKILL.md'),
    readRepo('.claude/skills/showcrafter-design-system/SKILL.md'),
  );
});

test('global tokens preserve visible focus and real monospace metadata', () => {
  const css = readPlatform('app/globals.css');
  const layout = readPlatform('app/layout.tsx');

  assert.doesNotMatch(css, /:where\(\*\):focus/);
  assert.match(css, /--color-bg-surface: var\(--color-bg-default\);/);
  assert.match(css, /--color-border-strong: var\(--color-border-emphasis\);/);
  assert.match(css, /--font-mono:\s*var\(--font-geist-mono/);
  assert.match(layout, /import \{ Geist, Geist_Mono \} from 'next\/font\/google';/);
  assert.match(layout, /variable: '--font-geist-mono'/);
});

test('brand count badges pair marker green with its semantic ink token', () => {
  const shell = readPlatform('app/components/app/AppShell.tsx');
  const countBadge = shell.slice(
    shell.indexOf('const SIDEBAR_NAV_COUNT_BADGE_CLASS'),
    shell.indexOf('const PROFILE_THEME_OPTIONS'),
  );

  assert.match(countBadge, /border-hl text-hl-ink/);
  assert.doesNotMatch(countBadge, /violet/);
});

test('the manifest retains packages imported by global styles', () => {
  const pkg = JSON.parse(readPlatform('package.json'));
  const css = readPlatform('app/globals.css');

  assert.match(css, /@import 'shadcn\/tailwind\.css';/);
  assert.equal(typeof pkg.dependencies.shadcn, 'string');
  assert.equal(existsSync(join(platformRoot, 'app/components/ui/tokens.ts')), false);
});
