// Hover clocks target selected sources and retain late modifiers.
import assert from 'node:assert/strict';
import test from 'node:test';
import { effectTemplates } from '../../../packages/fireworks/src/index.ts';
const source = effectTemplates.find((item) => item.key === 'peony').design;
import { previewWindow } from '../lib/studio/preview-window.ts';
test('hover clocks include late modifiers, selected delayed breaks and the launch climb', () => {
  const document = structuredClone(source);
  const delayed = structuredClone(document.breaks[0]);
  delayed.at_s = 12;
  delayed.layers[0].id = 'late-stars';
  delayed.layers[0].delay_s = 1;
  document.breaks.push(delayed);
  const clip = previewWindow(document, 'layer:1:late-stars', false);
  assert.equal(clip.from_s, document.launch.time_s + 13);
  assert.ok(clip.to_s > clip.from_s + delayed.layers[0].life_s);
  const climb = previewWindow(document, 'launch', true);
  assert.equal(climb.from_s, 0);
  assert.equal(climb.to_s, document.launch.time_s + 0.35);
});
