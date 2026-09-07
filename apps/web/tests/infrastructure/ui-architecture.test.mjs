import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Linter } from 'eslint';
import architecture, { importBoundaryViolation } from '../../scripts/eslint-rules.mjs';

test('shared UI cannot reach up into features or route implementations', () => {
  for (const [importer, target] of [
    ['ui/primitives/button.tsx', '@/ui/patterns/Button'],
    ['ui/patterns/Input.tsx', '../music/JamendoSongSearch'],
    ['ui/music/Picker.tsx', '@/app/(app)/shows/new/_components/MusicStep'],
    ['app/(my-store)/my-store/page.tsx', '@/app/(admin)/admin/_components/Overview'],
    ['app/(app)/home/page.tsx', '../shows/_components/ShowsToolbar'],
  ])
    assert.ok(importBoundaryViolation(importer, target), `${importer} -> ${target}`);
});

test('composition, route descendants and explicit server actions remain valid', () => {
  for (const [importer, target] of [
    ['ui/patterns/Button.tsx', '@/ui/primitives/button'],
    ['ui/primitives/button.tsx', '@/lib/utils'],
    ['ui/assortments/Editor.tsx', '@/app/actions/admin-assortments'],
    ['app/(admin)/admin/assortments/[id]/page.tsx', '@/ui/assortments/AssortmentEditor'],
    ['app/(app)/shows/[id]/page.tsx', '../_components/ShowsToolbar'],
  ])
    assert.equal(importBoundaryViolation(importer, target), null, `${importer} -> ${target}`);
});

test('ESLint checks static imports, re-exports and dynamic imports', () => {
  const linter = new Linter();
  const config = {
    files: ['**/*.js'],
    plugins: { architecture },
    rules: { 'architecture/boundaries': 'error' },
  };
  for (const code of [
    "import Button from '@/ui/patterns/Button';",
    "export { Button } from '@/ui/patterns/Button';",
    "export * from '@/ui/patterns/Button';",
    "const lazy = import('@/ui/patterns/Button');",
  ]) {
    const messages = linter.verify(code, config, { filename: 'ui/primitives/example.js' });
    assert.equal(messages.length, 1);
    assert.equal(messages[0].ruleId, 'architecture/boundaries');
  }
});

test('shared styling uses tokens while data colours remain representable', () => {
  const linter = new Linter();
  const config = { plugins: { architecture }, rules: { 'architecture/semantic-colours': 'error' } };
  for (const code of ["const classes = 'bg-[#ffffff]';", 'const classes = `text-[rgb(0,0,0)]`;']) {
    assert.equal(linter.verify(code, config)[0]?.ruleId, 'architecture/semantic-colours');
  }
  assert.equal(
    linter.verify(
      "const classes = 'bg-card text-foreground'; const fireworkColour = '#ff0000';",
      config,
    ).length,
    0,
  );
});
