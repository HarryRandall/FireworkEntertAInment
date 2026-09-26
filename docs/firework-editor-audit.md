# Firework editor audit

Status: in progress on `refactor/firework-renderer-editor`. This is a work list,
not a release approval. The target is one renderer and one understandable editor,
with no retained renderer generations or silent replacement fireworks.

## Product direction

Keep the preview visible, settings beside it and a compact parts tree at the far
right. Mobile uses a right-hand parts drawer. Every section must answer what it
changes, which layer it affects, when it applies and how to restore it. Prefer
explicit units, exact entry and live feedback to unexplained percentages.

Research consulted on 26 September 2026:

- [Unity emission module](https://docs.unity3d.com/Manual/PartSysEmissionModule.html)
  separates rate over time, rate over distance and timed bursts. Apply that
  distinction to our labels: a maximum particle count is not an emission rate.
- [Houdini Particle Trail](https://www.sidefx.com/docs/houdini/nodes/sop/particletrail.html)
  treats trails as a separate operation, with controls for their shape and
  progression. Give trails their own tree branch and explain head-to-tail
  changes separately from changes over a particle's lifetime.
- [Blender emission reference](https://docs.blender.org/manual/id/5.0/physics/particles/emitter/emission.html)
  distinguishes particle count, lifetime, variation and seed. Preserve a stable
  preview seed while editing and comparing; expose duration independently of
  particle size and spread.

These are interaction references, not a claim that a general-purpose VFX editor
is the best interface for a firework catalogue. Keep the vocabulary specific to
fireworks and avoid requiring users to understand a node graph.

## Findings and changes

| Finding                                                 | Evidence                                                                                                                     | Action/status                                                                                                                                                                                                             |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trail amount reaches an invisible ceiling               | Renderer shared 24,000 particles across paths; UI allowed 2,000 per path and used a different estimate                       | Shared `emission.ts` now supplies star counts, split-path reservations and the control maximum. Disabled trails do not consume a reservation. The panel shows the effective maximum and explains a saved preset above it. |
| Short trails plateau independently of the total budget  | Minimum spacing of one scene unit in `effects/stars.ts`                                                                      | Removed that artificial spacing floor. Seeded test confirms 300 to 600 increases density on a short slow path. A small numerical floor and a per-step safety limit remain.                                                |
| Fountain emission outlasted its calculated duration     | Emitter lived for duration plus 0.5 seconds and emitted throughout                                                           | Stops emission at the declared duration. Ground timing and budgets use the same duration function.                                                                                                                        |
| Star controls disagreed with schema/setter limits       | Size showed 4,000 versus schema 1,000; terminal fall speed showed 60 versus setter 18; speed/lifetime controls stopped early | Star controls now use existing shared limits, including speed 0–20 and lifetime 0.05–30 seconds. Complete metadata/schema consolidation remains.                                                                          |
| Star visibility was unavailable in the new inspector    | `head.visible` consumed at spawn but no control in `StarPartControls`                                                        | Added a visible-head switch that retains trails and movement.                                                                                                                                                             |
| Trail duration was missing                              | Model and renderer had lifetime settings, but the trail inspector did not expose them                                        | Added fixed duration, remaining-star-life fraction, afterglow and lifetime variation with units.                                                                                                                          |
| Trails were buried under each star layer                | Both trail pages were nested under Burst                                                                                     | Added a top-level Trails branch, with independent outer and inner trails.                                                                                                                                                 |
| Two trail pickers had the same label                    | Built-in compositions and saved database presets both said Trail style                                                       | Built-in picker now says Built-in trail preset. Consolidating their placement remains.                                                                                                                                    |
| Dead simplified trail panel mislabelled width as Length | Unused `EditorTrailPanel` set `width.tail` from Length                                                                       | Removed it; the shared trail editor is the single control path.                                                                                                                                                           |
| Cancelling a gesture lost redo                          | `DraftHistory.observe` cleared future entries before cancellation                                                            | Cancelled and no-op gestures restore the previous redo stack; covered by tests.                                                                                                                                           |
| Renderer extraction escaped the import fingerprint      | New modules were absent from the old source list                                                                             | All renderer source modules are listed, with a coverage guard. App, worker and a new database migration share the new fingerprint. Applying the migration and revalidating sealed evidence remain rollout requirements.   |
| Regression capture ignored RGB                          | Fixture read nonexistent particle `r/g/b` fields                                                                             | Seeded capture now records `color.r/g/b` and alpha. Fixture is for the current renderer, not a compatibility promise.                                                                                                     |

A count is a maximum over the star's flight, not a promise that every particle is
visible simultaneously. Short paths, opening visibility, crackle, density curves
and lifetime can reduce visible particles. The UI must make that distinction.

The next control pass also found and corrected:

- Star sizes below 40 were forced to 40 during spawning. Authored sizes now stay
  distinct, and implicit random size decay no longer shortens the chosen burn time.
- A strobe dark size of zero recycled the star permanently. It now hides the head
  with alpha and allows the next flash. Removed the unused alternate strobe field
  that could blink even when the Strobe switch was off.
- Extra effects now use typed numeric definitions with explanations, units and
  explicit input types. Strobe, crackle and splitting have named groups. Crackle
  ignition chance is displayed per second, with a reversible conversion to its
  simulation probability. Field/schema endpoint tests cover all these controls.
- Removed calibrated-percentage helpers and label-based input selection. Brightness
  and glow inputs declare their own type and scale. An untouched number field no
  longer rounds its saved value merely because it received and lost focus.
- Ground emitters and disabled parent layers show persistent availability reasons.
  Flight exposes its maximum duration, and Shell no longer repeats Flight settings.
- Reduced the shared inspector to 288px with compact padding, preserving the
  far-right parts tree and the mobile drawer.
- Shared sliders retain the typed draft while previewing, restore the original
  value on Escape, show units beside exact entry and hide floating-point display
  noise. Browser checks verified 50% ignition chance, one-step undo, cancellation
  and preservation of redo when focusing and leaving an unchanged field.

The refreshed 24-composition simulation fixture keeps all timing unchanged.
Crackle's seeded peak rose from 2,359 to 2,721 particles (15.35%). An isolated
in-memory experiment restored only the removed random draw and reproduced the
old 2,359 peak, identifying the changed random sequence as the cause. No dummy
random draw is retained in the renderer. Multi-seed dense-show frame benchmarks
remain required; a single-seed count is not performance clearance.

The motion pass removed shape-dependent lateral/downward speed caps. A particle's
shape now affects drawing only. Star air resistance scales both quadratic drag
and damping, so zero truly removes air resistance. The authored terminal fall
speed is applied before displacement, so zero prevents downward movement rather
than allowing a small fall every frame. Motion settings are preserved in preview
snapshots and reset on particle reuse. Tests cover speed 20, zero resistance,
zero and non-zero fall limits, identical motion across shapes and snapshot restore.
All 24 catalogue compositions retain their peak counts and timing in this pass.

## Remaining audit and implementation

1. **Control metadata and limits.** Inventory each exposed field against schema,
   setter, simulation, shader and timing usage. Extend the typed extra-effect
   definitions to the remaining controls. Verify both ends and numerical entry for
   every range. Remove schema coercions that reinterpret old percentages.
2. **Physics and geometry.** Review remaining emitter-specific motion multipliers,
   implicit life/size decay and shader sprite limits.
   Make artistic choices explicit or explain real safety limits. Check geometry
   multipliers, minimum counts and controls ignored by ground/comet behaviours.
3. **Sections.** Apply the clearer trail structure to Launch, Burst, Extra effects,
   Timing and Sound. Separate counts from motion, motion from burn/fade, and layer
   settings from shared settings. Replace anonymous Advanced groups with names.
   Add persistent reasons for unavailable controls. Review ground firework terms.
4. **Presets.** Place compatible preset selection consistently. Verify copied
   settings, independent siblings, provenance, reset and one-step undo across all
   three editors. Distinguish creation from updating an existing preset. Verify
   inner-trail preview carriers and whole-effect metadata preservation.
5. **Draft state.** Verify gestures, keyboard/touch cancellation, record switching,
   save failure recovery and Saved/Draft at identical seed/playhead. Confirm saved
   baseline updates only after success and section reverts remain undoable.
6. **Invalid records.** Complete field-linked errors and deduplicated toast/report
   handling. Mark invalid admin catalogue records. Check every public replay,
   card, multishot, generation and import caller without default substitutions.
7. **Persistence.** Review transactional history and snapshot writes, idempotent
   backfill, restored versions and source-preset independence. Fresh database and
   RLS verification are required. No production changes have been made.
8. **Single renderer cleanup.** Remove remaining unused compatibility fields,
   converters, fallback queries and obsolete tests in this renderer/editor scope.
   Keep migration history and import evidence protocol distinct from renderer
   appearance. Complete package entry-point and standalone package checks.
9. **Visual calibration.** Review actual footage for sphere, ring, Brocade, willow,
   comet, fountain and crossette. Store references and seeded launch/burst/fade
   captures with observations. Current seeded fixtures are simulation regression
   evidence only; they do not prove visual calibration.
10. **Performance and integration.** Check dense-show median frame time and peak
    particles on the same fixture/environment, investigating increases over 10%.
    Verify replay restart, seek, loop, sound, multishots and fixed-step import
    capture. Run full app/package/service/contract/database checks and light/dark,
    narrow/wide UI checks before release.

## Verification so far

- Local authenticated browser: desktop/mobile width; tree at far right; compact
  settings panel; reversed knob dragging in both directions; trail count above
  the effective maximum clamps on commit; one Undo restores the prior count.
- Package tests cover compilation diagnostics, catalogue round trips, disabled
  emitters, cue timing after invalid cues, copied presets, section reverts,
  history transactions, geometry-aware budgets and density on short paths.
- A current seeded regression fixture covers all catalogue compositions.
- Worker suite: 68 tests passed. Analyser suite: 35 tests, one skipped.
- Peak counts did not increase above 10% against the captured pre-audit working
  renderer fixture. Earlier extraction changes increased counts for several
  families compared with the original renderer, so full dense-show performance
  investigation remains open. These observations are not GPU frame benchmarks.

## Rollout constraints

The development branch is not ready for production. Deploy compatible schema and
readers, preview/apply the snapshot backfill, verify all records, then enable new
writes through the existing manual release gate. The renderer fingerprint
migration invalidates older sealed import evidence, which must be revalidated.
Do not silently reuse that evidence or retain an old renderer to accept it.
