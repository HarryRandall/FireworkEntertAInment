# Studio inspector

Studio reads and edits the stored v1 renderer document. The layer tree selects a
star group by break index and stable layer ID. After a break is removed, selection
falls back to an existing source rather than leaving an orphaned inspector.

## Controls

- Launch: height, climb speed, all renderer tail styles, smoke, lean, tail density
  and spread. Height scales climb time by the square root of the height ratio.
- Burst: complete break list, add/remove, apex-relative delay, independent core
  flash and centre ring, ring colour, strength, count, radius and fade controls.
- Stars: all renderer patterns, colour mode and gradient stops, brightness keys,
  radius, count, spread, burn, droop, head size and physics/fine controls.
- Trail: emission on/off, nine proven template looks, house/star/custom spark
  colours, length, density, spray, glitter, fall, size and flicker.
- Effect: multiple modifier chips, preserving authored order. Each instance shows
  only the fields its simulation kernel consumes. Twinkle uses 1.5 to 28 Hz.
  Ghost timing comes from the colour envelope; enabling ghost supplies a starting
  colour-transition clock without replacing the gradient.
- Ground: each emitter's relative controls, plus applicable shape and colour
  editing. Ground-only designs retain one inspector tab.
- Sound: all four stored mix channels, browser preview mute and listener distance.
  Listener distance changes the Viewer camera and sound arrival; it is not part of
  the stored firework. The automatic camera frame is retained until distance is
  explicitly adjusted.

Quick adjustments use the renderer's persisted seven-step adjective levels. A
fine edit resolves the current appearance into the base document before changing
it, so inherited levels are not applied twice. When layer IDs repeat across
breaks, layer quick controls are disabled because the stored adjustment key would
address every matching ID. Fine controls remain scoped to the selected group.

Relative sliders display words rather than measurements. Existing values outside
prototype tuning ranges extend the slider bounds to preserve authored designs.
The schema remains the validation boundary. Chip rows become a select when the
inspector's available width falls below the prototype's narrow-control threshold.

## History and persistence

Every authored edit replaces the validated document through the existing reducer.
Pointer drags and number-row typing use begin/commit boundaries. Cancellation
restores the gesture's original document; undo/redo restore complete snapshots.
Invalid edits keep the previous valid draft and show an error.

Autosave uses the existing draft RPCs and serial queue. Published versions remain
immutable. Turning a bare trail back on starts from the schema's default density;
the remaining trail settings are retained. Layer visibility changes only the
preview.

## Verification and review

`apps/web/tests/studio-inspector.test.mjs` covers all scalar control families,
validation, scoped edits, break limits and identifiers, relative-level persistence,
height/time coupling, modifier composition, ghost timing, core independence and
history. `packages/fireworks/tests/brightness-curve.test.mjs` proves equal-peak
curves produce different per-star alpha over life without changing motion.

`tests/browser/studio.spec.ts` covers the authenticated inspector, every section's
edits and Viewer redraws, quick adjustments, curve/gradient drags, layers,
undo/redo, failed autosave recovery, saved reloads and non-admin refusal. Desktop
and 390 px journeys run in both themes, checking axe and page overflow. Draw
completion is observed through the Viewer's actual diagnostics rather than a
fixed delay.

The composer runs the browser suite against the existing local app, with no
second dev server. Screenshots are written to
`output/playwright/studio-{desktop|phone}-{light|dark}-inspector-{section}.png`,
including Physics, Sound and Ground, plus full-shell and stage captures. Compare
these with the read-only `prototype/studio.html` and its relative-control
interactions from `prototype/editor.html`. Screenshots and owner visual review
remain separate from type-checking and unit-test evidence.
