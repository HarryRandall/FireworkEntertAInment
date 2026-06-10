/** Static guard for the shared info tooltip affordance. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';

const root = process.cwd();

test('info tooltip uses the shadcn icon and tooltip behaviour', () => {
  const source = readFileSync(join(root, 'app/components/ui/InfoTooltip.tsx'), 'utf8');

  assert.match(source, /import \{ Info \} from 'lucide-react'/);
  assert.match(source, /<TooltipTrigger asChild>/);
  assert.match(source, /<Info className="size-3" aria-hidden \/>/);
  assert.match(source, /<TooltipContent>\{text\}<\/TooltipContent>/);
  assert.doesNotMatch(source, /cursor-help/);
  assert.doesNotMatch(source, /hover:text-foreground/);
  assert.doesNotMatch(source, /text-\[9px\]/);
  assert.doesNotMatch(source, />i<\/span>/);
});

test('tooltip primitive uses the default app surface with a matching arrow', () => {
  const source = readFileSync(join(root, 'components/ui/tooltip.tsx'), 'utf8');

  assert.match(source, /<TooltipPrimitive\.Arrow/);
  assert.match(source, /bg-background text-foreground/);
  assert.match(source, /bg-background fill-background/);
  assert.doesNotMatch(source, /bg-foreground text-background/);
});
