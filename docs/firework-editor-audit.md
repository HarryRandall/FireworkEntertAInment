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

The preset and comparison pass found:

- Inner-star and inner-trail presets previewed with an outer carrier and a disabled
  inner layer. Each now uses its own layer; optional preview carriers remain outside
  the saved part. Tests verify that no outer layer leaks into an inner-trail preset.
- Star preset extraction discarded colours, launch extraction discarded maximum
  flight time, and geometry extraction discarded distribution. Copy/reset now
  includes those settings while preserving neighbouring parts. Firework palette
  state follows an applied preset rather than overwriting its copied colours.
- Invalid whole-effect selection changed the selected effect before validation.
  Selection now validates first, rejects missing models and leaves the draft intact
  on failure. Part-preset validation is also reported in the editor.
- Saved comparison mixed draft appearance, calibre or timeline settings with the
  saved design. Appearance, calibre and ticks now use the selected snapshot, and
  both views share a duration long enough for either design. Browser checks verified
  a three-second playhead stayed fixed when switching the preset comparison.
- Save handlers marked the draft as the saved baseline before persistence returned.
  Baselines now change only on success. A browser validation-failure check retained
  the invalid draft and Undo restored its original name afterwards.
- Preset editors now use the same parts tree and Appearance/Colours/Movement pages
  as the other editors, with section reverts. Undo retains the current section.
  Loading skeletons match the preview/inspector/tree arrangement. Movement controls
  use the inspector's available width rather than the browser width to choose columns.
- Reverting launch/burst audio also reverted crackle audio, even though it is edited
  separately. Its section revert now changes only the advertised settings.

The diagnostics pass separates invalid renderer settings from save failures in all
three editors. A persistent panel lists individual compiler paths and messages,
links to their owning sections and marks those sections in the parts tree. Unknown
paths never point at an unrelated control. Saving remains blocked. Diagnostic
details include the record ID and current renderer fingerprint. Duplicate or
reordered errors produce one notification per opened record; fixing the errors
dismisses it. Initial notification delivery also handles React Strict Mode.

An isolated browser fixture verified section navigation, disabled Save/recovery,
record switching, duplicate suppression, long-path wrapping and light/dark,
narrow/wide layouts. No invalid catalogue records were written for this check.
These are section links, not yet inline errors attached to individual inputs.
Remaining public-consumer validation still needs auditing.

The catalogue pass now validates the stored effect, preset or resolved firework
snapshot before normalisation. Invalid cards carry a visible status, hide cached
posters and do not queue preview or thumbnail capture. They remain links to the
editor. Invalid presets are excluded from compatible preset pickers. Admin preview
requests return structured 422 responses, distinct from transient read failures.
Malformed source JSON is preserved when opening or reverting the editors, rather
than being replaced with an empty default document.

Firework card previews now compile only their copied snapshot. A behaviour test
changes the source effect, including making it invalid, and confirms the saved
preview remains identical. The draft editor also stops merging that live effect.
Removed duplicate schema-fallback queries which merely retried the same select.
Read cache keys changed so old cached summaries cannot bypass the new diagnostics.

An isolated browser fixture verified invalid cards make no preview/capture requests,
keep their repair links and hide both persisted and session posters. Valid cards
still activate. Light/dark and narrow layouts were checked. The authenticated local
catalogue and Chrysanthemum Default editor loaded successfully. The latter displays
a colour-section dirty indicator while the document says Saved; palette initialisation
and structural comparisons still need investigation before claiming reopen fidelity.
Cached poster renderer identifiers also need review: they currently describe image
format/resolution rather than the current simulation fingerprint.

## Copied colour settings and shared palette controls

The firework editor previously reconstructed renderer colours from parallel hex
and percentage state on opening. That rounded RGB channels and weights and could
change the selected pattern before an edit. It now edits the saved document
through the same outer/inner palette controls as effects and saved part presets.
Catalogue swatches are derived metadata and never feed back into compilation.
The duplicate colour UI and its state synchronisation have been removed.

Existing firework saves, inline preset saves and history restores now validate
the copied render document without re-reading the source effect or applying
catalogue palette metadata. Validation preserves the authored document, including
precision, disabled colours and preset provenance. Creating a new firework still
explicitly copies and validates the chosen effect.

Palette controls now show relative weights and a distribution bar. Solid edits
the first palette entry actually used by the renderer, retaining other entries
for mixed patterns. Adding colours or selecting a pattern starts from the layer's
own colours, rather than inserting a hard-coded gold/orange palette. The ignored
Band count control was removed; repetitions apply only to stripes. Both layers
have correctly named controls. Colour enable/disable retains the authored palette.

Verification: 605 app tests, 34 package tests, 11 database-tooling tests, typecheck,
build and UI audit pass locally. Focused tests preserve fractional RGB/weights and
provenance through the save validator, reject invalid creation sources and check
independent layers through the real control hook. Authenticated browser checks
confirmed no initial dirty-colour indicator, a single Undo for a weight edit,
colour toggle retention and Solid keeping the remaining palette. Light and dark
palette layouts fit the 256px panel. No catalogue records were saved during these
browser checks. Mobile layout was checked for the preceding shared-width change;
mobile palette interaction still needs a dedicated check.

Further colour work remains: the compiler currently turns disabled colours white
in its returned design, so creation, whole-effect copying, saving part presets
and section reverts must distinguish authored settings from simulated appearance.
Inherited colours still contain strobe/pearls-specific accent rules and a default
22% accent share. These need explicit behaviours, not hidden runtime overrides.

## Editor simplification after hands-on feedback

The user found the header copy, debug overlay, rotary controls and repeated preset
actions distracting. The three editors now start directly with their controls.
The duplicate document toolbar and section introduction block are removed. Save
and icon-labelled Undo/Redo live in a compact footer; saved/draft comparison and
section/document reverts are in its action menu. Mobile Parts navigation remains
available in that footer. Preset creation/reset is beside the preset picker in a
menu instead of two persistent buttons.

The editors no longer show the FPS overlay or the floating camera button rail.
Direct camera gestures remain available, and loop controls are in the preview
transport. The particle cap still bounds numerical entry, with its explanation
in the field's help tooltip instead of an always-visible technical paragraph.

Rotary controls have been replaced by horizontal sliders. Renderer sliders place
the exact input above the track, providing the full panel width for dragging,
and the shared slider has a larger pointer/touch hit area. Counts remain number
fields. The loading skeleton matches the simplified frame.

An isolated browser fixture used the actual shared shell, renderer controls,
preset dialogs and draft history with stubbed saving. It verified rightward drag
increases glow, one Undo restores the entire drag, ArrowLeft decreases by the
advertised step, section revert works, and preset creation opens its dialog and
completes. Light desktop and dark mobile layouts were inspected. The mobile
footer stays 49px tall at 390px viewport width, the parts drawer selects sections,
and there is no horizontal page overflow. The user's active catalogue draft was
not used for these interaction checks.

## Disabled palette preservation

Compilation now retains authored colours even when the colour switch is off.
Previously it replaced both star palettes with white, which meant copying an
effect, resetting a part preset or reverting a saved section could discard the
disabled palette. The colour switch now resolves at simulation entry without
mutating the document. Copied snapshots retain exact RGB values and weights.

Seeded captures taken before this boundary change cover all 24 catalogue
compositions with disabled colours, random palette entries and an enabled inner
layer. Particle hashes, peak counts and timing match after the change. The
ordinary catalogue fixture also remains unchanged. Tests cover copying both
layers, preset status, reset, section revert, simulation immutability and
re-enabling colours after reopening.

The app, worker and migration `20260926000300` carry the updated source fingerprint.
This is an import-evidence contract update, not another renderer generation.
The migration has not been applied to a running database; rollout still requires
revalidation of sealed import evidence.

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
  settings panel; horizontal slider dragging and keyboard adjustment; trail count above
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
