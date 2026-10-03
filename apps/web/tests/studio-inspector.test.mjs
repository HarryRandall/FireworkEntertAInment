/** Inspector edits exercise stored units, selection isolation, validation and gesture history. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { effectTemplates, designSchema, resolveDesign, simulate } from '@showcrafter/fireworks';
import {
  editDesign,
  setAdjustment,
  setCorePart,
  inspectorLayer,
  changeLaunchHeight,
  addBreak,
  removeBreak,
  toggleModifier,
  setTrailEnabled,
} from '../lib/studio/inspector.ts';
import { studioSelection, layerAddress } from '../lib/studio/layers.ts';
import { createHistory, studioReducer } from '../lib/studio/document.ts';
import { MODIFIER_CONTROLS } from '../lib/studio/modifier-controls.ts';
import { trailLooks } from '../lib/studio/trail-looks.ts';
import { LAUNCH_CONTROLS } from '../lib/studio/launch-controls.ts';
import { STARS_CONTROLS, HEAD_CONTROLS } from '../lib/studio/star-controls.ts';
import { TRAIL_CONTROLS } from '../lib/studio/trail-controls.ts';
import { CORE_CONTROLS, FADE_CONTROLS, BREAK_CONTROLS } from '../lib/studio/burst-controls.ts';
import { SOUND_CONTROLS } from '../lib/studio/sound-controls.ts';
import { COMETS_CONTROLS } from '../lib/studio/comets-controls.ts';
import { FOUNTAIN_CONTROLS } from '../lib/studio/fountain-controls.ts';
import { TOURBILLON_CONTROLS } from '../lib/studio/tourbillon-controls.ts';
import { WHEEL_CONTROLS } from '../lib/studio/wheel-controls.ts';
import { SPINNER_CONTROLS } from '../lib/studio/spinner-controls.ts';

const shell = effectTemplates.find((item) => item.key === 'peony').design;
function edited(document, change) {
  const result = editDesign(document, change);
  assert.equal(result.kind, 'edited', result.message);
  assert.equal(designSchema.safeParse(result.document).success, true);
  return result.document;
}
function midpoint(control) {
  return control.step === 1 || control.step >= 5
    ? Math.round((control.min + control.max) / 2)
    : (control.min + control.max) / 2;
}
test('height and climb time preserve the square-root relation without mutating the source', () => {
  const original = structuredClone(shell);
  const next = edited(shell, (draft) => changeLaunchHeight(draft, shell.launch.height_m * 2));
  assert.equal(next.launch.time_s, shell.launch.time_s * Math.sqrt(2));
  assert.equal(next.launch.height_m, shell.launch.height_m * 2);
  assert.deepEqual(shell, original);
});
test('adding/removing breaks keeps complete valid bursts, unique IDs and at least one burst', () => {
  const multi = edited(shell, addBreak);
  assert.equal(multi.breaks.length, shell.breaks.length + 1);
  const added = multi.breaks.at(-1);
  assert.equal(added.at_s, shell.breaks.at(-1).at_s + 0.5);
  assert.notEqual(added.layers[0].id, shell.breaks[0].layers[0].id);
  assert.deepEqual(
    edited(multi, (draft) => removeBreak(draft, 1)),
    shell,
  );
  assert.deepEqual(
    edited(shell, (draft) => removeBreak(draft, 0)),
    shell,
  );
  assert.equal(
    edited(
      { ...shell, breaks: Array.from({ length: 64 }, () => structuredClone(shell.breaks[0])) },
      addBreak,
    ).breaks.length,
    64,
  );
});
test('scoped edits leave sibling layers and breaks intact, even when IDs repeat', () => {
  const multi = { ...shell, breaks: [shell.breaks[0], structuredClone(shell.breaks[0])] };
  const selected = { breakIndex: 1, layerId: shell.breaks[0].layers[0].id };
  const next = edited(multi, (draft) => {
    inspectorLayer(draft, selected).radius_m = 33;
  });
  assert.equal(next.breaks[1].layers[0].radius_m, 33);
  assert.deepEqual(next.breaks[0], shell.breaks[0]);
  assert.equal(inspectorLayer(next, { breakIndex: 2, layerId: 'absent' }), undefined);
});
test('inherited adjustments are resolved once before direct controls edit displayed values', () => {
  const adjusted = { ...shell, adjustments: { 'launch.height': 2, 'layer.l1.burn': 1 } };
  const next = edited(adjusted, (draft) => {
    draft.sound.break = 0.4;
  });
  const expected = resolveDesign(adjusted);
  expected.sound.break = 0.4;
  assert.deepEqual(next, expected);
  assert.equal(next.adjustments, undefined);
});
test('invalid inputs are refused and leave the previous valid document unchanged', () => {
  for (const value of [NaN, Infinity, -1, 1001]) {
    assert.equal(
      editDesign(shell, (draft) => {
        draft.launch.height_m = value;
      }).kind,
      'invalid',
    );
  }
  assert.equal(shell.launch.height_m > 0, true);
});
test('several modifiers compose in saved order and only the selected kind is removed', () => {
  const next = edited(shell, (draft) => {
    const layer = draft.breaks[0].layers[0];
    layer.modifiers = [];
    for (const kind of ['twinkle', 'fish', 'glitter']) toggleModifier(layer, kind);
    toggleModifier(layer, 'fish');
  });
  assert.deepEqual(
    next.breaks[0].layers[0].modifiers.map((item) => item.kind),
    ['twinkle', 'glitter'],
  );
  const twinkle = MODIFIER_CONTROLS.twinkle.find((item) => item.key === 'rate_hz');
  assert.equal(twinkle.min, 1.5);
  assert.equal(twinkle.max, 28);
  for (const [kind, controls] of Object.entries(MODIFIER_CONTROLS)) {
    edited(shell, (draft) => {
      const layer = draft.breaks[0].layers[0];
      layer.modifiers = [];
      toggleModifier(layer, kind);
      for (const control of controls) layer.modifiers[0][control.key] = midpoint(control);
    });
  }
});
test('all proven trail looks exist and on/off preserves the remaining emission controls', () => {
  assert.equal(trailLooks.length, 9);
  for (const look of trailLooks)
    edited(shell, (draft) => {
      draft.breaks[0].layers[0].trail = structuredClone(look.trail);
    });
  const off = edited(shell, (draft) => setTrailEnabled(draft.breaks[0].layers[0], false));
  assert.equal(off.breaks[0].layers[0].trail.sparks, 0);
  const on = edited(off, (draft) => setTrailEnabled(draft.breaks[0].layers[0], true));
  assert.deepEqual({ ...on.breaks[0].layers[0].trail, sparks: 0 }, off.breaks[0].layers[0].trail);
  assert.ok(on.breaks[0].layers[0].trail.sparks > 0);
});
test('every launch, burst, star, trail, physics and mix control writes a valid stored field', () => {
  const cases = [
    [LAUNCH_CONTROLS, (draft) => draft.launch],
    [STARS_CONTROLS, (draft) => draft.breaks[0].layers[0]],
    [HEAD_CONTROLS, (draft) => draft.breaks[0].layers[0].head],
    [TRAIL_CONTROLS, (draft) => draft.breaks[0].layers[0].trail],
    [CORE_CONTROLS, (draft) => draft.breaks[0].core],
    [FADE_CONTROLS, (draft) => draft.breaks[0].fade],
    [BREAK_CONTROLS, (draft) => draft.breaks[0]],
    [SOUND_CONTROLS, (draft) => draft.sound],
  ];
  for (const [controls, target] of cases)
    for (const control of controls) {
      const next = edited(shell, (draft) => {
        target(draft)[control.key] = midpoint(control);
      });
      assert.equal(target(next)[control.key], midpoint(control));
    }
});
test('every ground emitter control writes valid stored values across its templates', () => {
  const controls = {
    comets: COMETS_CONTROLS,
    fountain: FOUNTAIN_CONTROLS,
    tourbillon: TOURBILLON_CONTROLS,
    wheel: WHEEL_CONTROLS,
    spinner: SPINNER_CONTROLS,
  };
  for (const template of effectTemplates.filter((item) => item.design.ground !== null)) {
    for (const [key, fields] of Object.entries(controls)) {
      if (!(key in template.design.ground)) continue;
      for (const control of fields)
        edited(template.design, (draft) => {
          draft.ground[key][control.key] = midpoint(control);
        });
    }
  }
});
test('a many-move inspector drag is one undo step and redo restores the complete document', () => {
  let history = studioReducer(createHistory(shell), { type: 'begin' });
  for (const height of [70, 80, 90])
    history = studioReducer(history, {
      type: 'replace',
      document: edited(history.document, (draft) => changeLaunchHeight(draft, height)),
    });
  history = studioReducer(history, { type: 'commit' });
  assert.equal(history.undo.length, 1);
  const final = history.document;
  history = studioReducer(history, { type: 'undo' });
  assert.deepEqual(history.document, shell);
  assert.deepEqual(studioReducer(history, { type: 'redo' }).document, final);
  assert.notDeepEqual(simulate(final, 2).positions, simulate(shell, 2).positions);
});

test('seven-step quick controls persist levels without compounding and direct edits retain the displayed look', () => {
  const result = setAdjustment(shell, 'launch.height', 2);
  assert.equal(result.kind, 'edited');
  assert.equal(result.document.launch.height_m, shell.launch.height_m);
  assert.equal(result.document.adjustments['launch.height'], 2);
  const higher = resolveDesign(result.document);
  assert.equal(higher.launch.height_m, shell.launch.height_m * 1.12 ** 2);
  assert.equal(higher.launch.time_s, shell.launch.time_s * Math.sqrt(1.12 ** 2));
  const next = setAdjustment(result.document, 'launch.height', 1);
  assert.equal(resolveDesign(next.document).launch.height_m, shell.launch.height_m * 1.12);
  assert.equal(
    edited(result.document, (draft) => {
      draft.sound.lift = 0.3;
    }).launch.height_m,
    higher.launch.height_m,
  );
  assert.equal(setAdjustment(shell, 'launch.height', 4).kind, 'invalid');
  assert.equal(setAdjustment(shell, 'unknown', 1).kind, 'invalid');
  assert.equal(setAdjustment(shell, 'layer.absent.size', 1).kind, 'invalid');
});
test('ghost chips create a consumed colour-transition clock and retain authored gradients', () => {
  const next = edited(shell, (draft) => toggleModifier(draft.breaks[0].layers[0], 'ghost'));
  assert.equal(next.breaks[0].layers[0].colour.reignition.at, 0.55);
  assert.deepEqual(next.breaks[0].layers[0].colour.stops, shell.breaks[0].layers[0].colour.stops);
});

test('core flash and centre ring enable independently even when an inherited core is disabled', () => {
  const core = { ...shell.breaks[0].core, enabled: false, flash_on: true, ring: true };
  setCorePart(core, 'ring', true);
  assert.equal(core.enabled, true);
  assert.equal(core.flash_on, false);
  assert.equal(core.ring, true);
  setCorePart(core, 'flash_on', true);
  setCorePart(core, 'ring', false);
  assert.equal(core.enabled, true);
  assert.equal(core.flash_on, true);
  setCorePart(core, 'flash_on', false);
  assert.equal(core.enabled, false);
});

test('structural edits keep the layer tree and inspector on a valid source', () => {
  const multi = edited(shell, addBreak);
  const id = multi.breaks[1].layers[0].id;
  assert.equal(studioSelection(multi, layerAddress(1, id)), layerAddress(1, id));
  const next = edited(multi, (draft) => removeBreak(draft, 1));
  assert.equal(
    studioSelection(next, layerAddress(1, id)),
    layerAddress(0, next.breaks[0].layers[0].id),
  );
  assert.equal(studioSelection(next, 'break:2'), layerAddress(0, next.breaks[0].layers[0].id));
  assert.equal(studioSelection(next, 'launch'), 'launch');
});
