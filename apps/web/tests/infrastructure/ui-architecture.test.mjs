import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Linter } from 'eslint';
import architecture, { importBoundaryViolation } from '../../scripts/eslint-rules.mjs';

test('shared UI cannot reach up into features or route implementations', () => {
  for (const [importer, target] of [
    ['components/ui/button.tsx', '@/components/design-system/Button'],
    ['components/design-system/Input.tsx', '../music/JamendoSongSearch'],
    ['components/music/Picker.tsx', '@/app/(app)/shows/new/_components/MusicStep'],
    ['app/(my-store)/my-store/page.tsx', '@/app/(admin)/admin/_components/Overview'],
    ['app/(app)/home/page.tsx', '../shows/_components/ShowsToolbar'],
  ])
    assert.ok(importBoundaryViolation(importer, target), `${importer} -> ${target}`);
});

test('composition, route descendants and explicit server actions remain valid', () => {
  for (const [importer, target] of [
    ['components/design-system/Button.tsx', '@/components/ui/button'],
    ['components/ui/button.tsx', '@/lib/utils'],
    ['components/assortments/Editor.tsx', '@/app/actions/admin-assortments'],
    ['app/(admin)/admin/assortments/[id]/page.tsx', '@/components/assortments/AssortmentEditor'],
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
    "import Button from '@/components/design-system/Button';",
    "export { Button } from '@/components/design-system/Button';",
    "export * from '@/components/design-system/Button';",
    "const lazy = import('@/components/design-system/Button');",
  ]) {
    const messages = linter.verify(code, config, { filename: 'components/ui/example.js' });
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
