/** Static guards for ShowCrafter's UI and repository guidance contracts. */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const projectRoot = process.cwd();

function readProject(path) {
  return readFileSync(join(projectRoot, path), 'utf8');
}

function hexChannels(value) {
  const match = /^#([0-9a-f]{6})$/i.exec(value);
  assert.ok(match, `Expected a six-digit hex colour, received ${value}`);
  return match[1].match(/.{2}/g).map((channel) => Number.parseInt(channel, 16));
}

function luminance(value) {
  const [red, green, blue] = hexChannels(value).map((channel) => {
    const normalised = channel / 255;
    return normalised <= 0.04045 ? normalised / 12.92 : ((normalised + 0.055) / 1.055) ** 2.4;
  });
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function contrast(first, second) {
  const brightest = Math.max(luminance(first), luminance(second));
  const darkest = Math.min(luminance(first), luminance(second));
  return (brightest + 0.05) / (darkest + 0.05);
}

function composite(foreground, background, opacity) {
  const front = hexChannels(foreground);
  const back = hexChannels(background);
  const channels = front.map((channel, index) =>
    Math.round(channel * opacity + back[index] * (1 - opacity)),
  );
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function lightToken(css, name, seen = new Set()) {
  assert.ok(!seen.has(name), `Circular colour alias --${name}`);
  seen.add(name);
  const match = new RegExp(`--${name}:\\s*([^;]+);`, 'i').exec(css);
  assert.ok(match, `Missing light theme token --${name}`);
  const value = match[1].trim();
  const alias = /^var\(--([\w-]+)\)$/.exec(value);
  return alias ? lightToken(css, alias[1], seen) : value;
}

test('global tokens preserve visible focus and real monospace metadata', () => {
  const css = readProject('app/globals.css') + readProject('styles/theme.css');
  const layout = readProject('app/layout.tsx');

  assert.doesNotMatch(css, /:where\(\*\):focus/);
  assert.match(css, /--color-bg-surface: var\(--color-bg-default\);/);
  assert.match(css, /--color-border-strong: var\(--color-border-emphasis\);/);
  assert.match(css, /--font-mono:\s*var\(--font-geist-mono/);
  assert.match(layout, /import \{ Geist, Geist_Mono \} from 'next\/font\/google';/);
  assert.match(layout, /variable: '--font-geist-mono'/);
});

test('brand count badges pair marker green with its semantic ink token', () => {
  const shell = readProject('components/shell/AppShell.tsx');
  const countBadge = shell.slice(
    shell.indexOf('const SIDEBAR_NAV_COUNT_BADGE_CLASS'),
    shell.indexOf('const PROFILE_THEME_OPTIONS'),
  );

  assert.match(countBadge, /border-hl text-hl-ink/);
  assert.doesNotMatch(countBadge, /violet/);
});

test('light theme text and focus tokens retain accessible contrast', () => {
  const css = readProject('app/globals.css') + readProject('styles/theme.css');
  const background = lightToken(css, 'background');
  const mutedSurface = lightToken(css, 'muted');
  const primary = lightToken(css, 'primary');
  const primaryForeground = lightToken(css, 'primary-foreground');
  const subtle = lightToken(css, 'color-content-subtle');
  const muted = lightToken(css, 'color-content-muted');
  const ring = lightToken(css, 'ring');
  const sidebar = lightToken(css, 'sidebar');
  const sidebarForeground = lightToken(css, 'sidebar-foreground');
  const sidebarRing = lightToken(css, 'sidebar-ring');

  assert.ok(contrast(primary, background) >= 4.5);
  assert.ok(contrast(primaryForeground, primary) >= 4.5);
  assert.ok(contrast(subtle, mutedSurface) >= 4.5);
  assert.ok(contrast(muted, mutedSurface) >= 4.5);
  assert.ok(contrast(composite(ring, mutedSurface, 0.5), mutedSurface) >= 3);
  assert.ok(contrast(sidebarForeground, sidebar) >= 4.5);
  assert.ok(contrast(sidebarRing, sidebar) >= 3);
});

test('the manifest retains packages imported by global styles', () => {
  const pkg = JSON.parse(readProject('package.json'));
  const css = readProject('app/globals.css') + readProject('styles/theme.css');

  assert.match(css, /@import 'shadcn\/tailwind\.css';/);
  assert.equal(typeof pkg.dependencies.shadcn, 'string');
  assert.equal(existsSync(join(projectRoot, 'components/design-system/tokens.ts')), false);
});

test('semantic status text is legible on its corresponding light surface', () => {
  const css = readProject('styles/theme.css');
  for (const status of ['success', 'danger', 'warning', 'info']) {
    assert.ok(
      contrast(lightToken(css, `status-${status}`), lightToken(css, `status-${status}-subtle`)) >=
        4.5,
      status,
    );
  }
});

test('compatibility colours resolve to the primary palette and theme is imported once', () => {
  const css = readProject('styles/theme.css');
  const global = readProject('app/globals.css');
  assert.equal((global.match(/@import '\.\.\/styles\/theme\.css';/g) ?? []).length, 1);
  assert.equal(lightToken(css, 'color-accent'), lightToken(css, 'accent'));
  assert.equal(lightToken(css, 'color-content-default'), lightToken(css, 'foreground'));
  assert.equal(lightToken(css, 'sidebar-primary'), lightToken(css, 'primary'));
});

test('dark status colours remain legible against their semantic surfaces', () => {
  const source = readProject('styles/theme.css');
  const css = source.slice(source.lastIndexOf(".dark,\n[data-theme='dark']"));
  for (const status of ['success', 'danger', 'warning', 'info']) {
    assert.ok(
      contrast(lightToken(css, `status-${status}`), lightToken(css, `status-${status}-subtle`)) >=
        4.5,
      status,
    );
  }
  assert.ok(contrast(lightToken(css, 'primary'), lightToken(css, 'primary-foreground')) >= 4.5);
});
