# Firework editor audit

Status: scope frozen for merge review on `refactor/firework-renderer-editor`
(26 September 2026). Local automated checks pass; the outstanding items below
are not covered by that result. The target is one renderer and one understandable
editor, with no retained renderer generations or silent replacement fireworks.

## Merge review checkpoint

The audit is no longer expanding. The implemented changes are ready for code
review, but this document does not approve production rollout or claim the full
redesign's acceptance criteria are complete.

- `pnpm check`: formatting, 11 database-tooling tests, 60 package tests, 610 app
  tests, TypeScript and the production build passed. Unused imports and helpers
  left by the extraction have been removed; lint has no warnings or errors.
- `pnpm test:worker`: 68 passed. `pnpm test:analyser`: 35 tests, one skipped.
  `pnpm test:import-contract` passed for all 19 supported geometries. The UI audit
  passed. Conversion rollback/concurrency checks and all nine local SQL suites
  passed.
- A clean installation through migration `20260926001100` passed in the disposable
  verification database: exact contents of 18 reusable tables, all 157 media
  hashes, installation receipt, renderer fingerprint, nine SQL suites and
  generated public types. The disposable stack was stopped and removed afterwards.
- Authenticated browser checks covered scene flash exact entry and one-step undo,
  explicit sound choices, burst/fade seeking, restart, fountain playback and its
  separate 126 sparks/second and 7.8-second duration. No browser errors were logged.
  A disposable local effect also passed two saves, immediate reload, history and
  restore through the real editor. It was removed afterwards. Earlier layout and
  gesture checks are recorded below; this does not replace full device testing.
- Remote references were refreshed: `origin/main` is an ancestor of this branch
  at `4917a8a`. The review stack is #403, then #404, then #405.
  Merging and deployment remain with the maintainer.

Resolve or explicitly defer these before treating the original plan as complete:

1. Dense-show GPU frame-time measurements and the recorded peak-particle increases
   above 10%. Their causes have been investigated, but performance is not cleared.
   The dense CPU benchmark below also exposes live-particle overwrites before the
   pool reaches capacity. Resolve that allocator issue before accepting a dense
   show's apparent performance improvement.
2. Remaining device-level save-failure coverage. Atomic save/history writes and
   restored versions are now implemented and covered by transaction and browser
   checks below.
3. Final invalid-record/caller coverage and full replay, multishot, touch and
   Saved/Draft comparison verification.
4. Footage-based calibration and reviewed visual captures. Seeded simulation
   fixtures prove repeatability, not realistic appearance.
5. Remaining launch emission/maximum-flight-time semantics and control metadata
   consolidation. These are follow-up work, not claims made by this branch.

Hosted rollout must coordinate app, worker, migrations, backed-up data conversion
and import-evidence revalidation through the existing manual release gate.

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

## Shape-specific movement controls

The movement inspector now hides controls that the selected algorithm does not
consume: star count for a single comet, and generic speed/gravity for a waterfall.
A short reason points to the waterfall's Shape settings. Stored values remain
intact when changing shapes. Runtime tests verify the omitted fields have no
effect on those star emissions and that the waterfall's own fall speed does.

Both movement layouts use one shared component. Speed and gravity variation are
available in a named disclosure in the parts editor, as well as the combined
preset controls. Unavailable sections now show their reason without a collection
of disabled controls or irrelevant preset actions.

Authenticated local browser checks used a separate unsaved draft: switching
through waterfall, comet and fountain shows the correct fields; Undo restores
the original shape and count. Editing speed variation from 0.6 to 0.2 reverses
in one Undo. The light desktop and 390px mobile layouts fit without horizontal
overflow. No catalogue data was saved during these checks.

Follow-up findings from this pass:

- Gravity used an upper bound with variation below it, while some shapes added
  extra jitter or forced downward acceleration. This is corrected below.
- Most shape counts multiply the layer count, while ground emitters impose
  minimum counts/rates. Their effective count/rate needs a direct, truthful
  control rather than several interacting percentages and minimums.
- On narrow screens the preview transport's timestamp and event ticks crowd
  the scrubber. It needs a responsive transport arrangement.

## Explicit star gravity

Gravity now displays the midpoint of the authored range; Variation is the spread
either side, matching the speed controls. Opening a saved record does not change
its range. Editing either value preserves the other layer and clamps the range
symmetrically at the model bounds. The obsolete upper-bound setters are removed.

The simulation no longer adds an unrequested random gravity offset or forces
weeping, falling-tail and pearl stars downwards. Named shape gravity multipliers
remain explicit, but no longer saturate at a hidden final-acceleration limit.
Split fragments inherit the parent's actual gravity rather than redrawing a
different value and multiplying it by 0.82.

Behavioural tests cover zero acceleration across all 19 shape algorithms, fixed
positive/negative gravity, explicit 300% multipliers, independent layer ranges
and fragment inheritance. An authenticated local editor check confirmed exact
zero entry and two Undo operations restoring the original gravity and variation;
no record was saved.

The 24-family seeded fixtures were intentionally refreshed for this motion and
random-sampling change. Estimated timing stayed unchanged across both fixtures.
One peak exceeded the 10% investigation threshold: disabled-colour Kamuro grew
from 2,626 to 2,895 particles (10.24%). A temporary in-memory experiment retained
the previous random draw order while removing the gravity jitter: its peak was
2,748, separating the trajectory effect from the downstream sampling effect.
That experiment is not retained in the renderer. Trail budgets are unchanged;
these counts do not establish dense-show GPU performance clearance.

The app, worker and new migration `20260926000400` share the updated renderer
fingerprint. No database migration or deployment was performed in this pass.

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
   backfill, restored versions and source-preset independence. Fresh-install and
   SQL/RLS verification passed in the isolated stack below. Atomic save/history
   verification remains. No production changes have been made.
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

### Direct emission controls

Fountain amount now means **sparks per second**, as requested, with independent
outer/inner rates. Emission duration is a separate seconds field, visible above
collapsed shape tuning. It no longer derives from shell flight lifetime. Roman
candles likewise have a direct duration and exact shot count. Other bursts use
an exact per-layer star count; removed shape percentage and minimum-count
settings no longer secretly multiply it. Comets still emit one star per enabled
layer. The supported star maximum is 200, covering the former 100 stars at 200%.

The emitter accumulates a target count from elapsed time, stops at the specified
duration and emits whole sparks only. Budgets use that same count. Tests exercise
all 19 geometries, independent layers, counts of 1/10/199/200, fractional rates,
short durations and frame steps from 1/120 second to 0.7 seconds. Preset copy,
reset and section revert retain rates; rate and duration edits do not overwrite
each other. Ground timeline scaling changes duration without changing shell life.

The catalogue's authored counts/rates/durations were converted to their prior
resolved emission values. Of 48 seeded captures, only the two waterfall captures
changed; peak counts and timing stayed unchanged in every capture. Waterfall
width still multiplies the star count, so converting its count also changes its
width. This coupling remains an explicit next audit item, along with the `size`
alias used for launch/flash. These fixtures are current-renderer regression
checks, not a promise of unchanged appearance or a GPU performance clearance.

`node scripts/renderer/preview-emission-conversion.mjs --local` is read-only.
Its initial local run found 26 effects, 90 resolved firework snapshots and 18 of
71 part presets requiring conversion, with no validation errors. The single
stored history record required no conversion. The converter rejects historical
fireworks with unresolved overrides instead of guessing their original effect.
It is not an apply command. Remaining rollout work includes copied preset
provenance, bootstrap data, original-data preservation, guarded transactional
writes, idempotence against the database and restored history verification.
Star-only presets retain their authored count because they have no owning shape;
geometry presets lose their implicit count multipliers. Review those semantics
before converting production content. Existing records have not been rewritten.

Authenticated browser verification used a separate unsaved draft: changed the
geometry to Fountain, entered 2.5 seconds and 12.5 sparks per second, confirmed
duration stayed 2.5, and undid each change separately back to Saved. Closed that
test tab without saving. The user's tab and draft were not changed. The duration
field's position was checked in the shared inspector; this pass did not repeat
all dark/mobile checks.

Local delivery checks: `pnpm check` (608 app tests, 49 package tests and 11 database
tooling tests, production build), `pnpm audit:ui` and 68 worker tests passed.
Eight existing lint warnings remain. The new renderer fingerprint is aligned in
the app, worker and migration `20260926000500`; that migration has not been applied.

### Saved settings and fresh-install verification

The emission backfill now includes copied preset provenance and both history
snapshots. Resetting an unmodified copied preset preserves its converted count
and rate; modified presets still report modifications. The plan compares JSON
structurally, rejects invalid/unresolved data and recalculates proposed writes
before execution. Applying requires a new private backup file. It locks the four
source tables, checks the complete original rows and advances saved revisions
in one transaction. A concurrent edit aborts every write. Tests against temporary
PostgreSQL tables verify conversion, history, quoting, concurrency rejection and
rollback of earlier writes when a later write fails.

Local application completed on 26 September: 26 effects, 90 firework snapshots
and 18 presets, 134 records total. No stored history needed conversion. A second
read returned zero pending changes. Original rows are retained in the ignored,
permission-restricted `.tmp/renderer-backups/emission-before-20260926.json` backup;
original firework overrides also remain in their existing column. Stale editor
drafts cannot overwrite these revisions. Production has not been converted.

Commands for a reviewed conversion:

```sh
node scripts/renderer/preview-emission-conversion.mjs --local
node scripts/renderer/test-emission-backfill.mjs
node scripts/renderer/backfill-emission.mjs --local --apply --backup .tmp/renderer-backups/emission-before.json
```

The bootstrap snapshot now contains resolved independent settings for all 90
fireworks, explicit emission fields in effects/parts and updated file hashes.
It retains identity, pricing/scheduling fields, original overrides and all media.
A fresh installation was verified in the separate
`showcrafter-renderer-verification` Supabase stack on ports 56520–56524, without
resetting the working database. Verification compared every value in all 18
reusable tables, uploaded and checked all 157 media hashes, checked the private
installation receipt and current renderer fingerprint, ran all eight SQL suites,
and confirmed generated public types match the committed types. That stack had
no accounts or user shows during fresh-install verification.

This pass also found that snapshot-only changes did not invalidate posters, and
that effect changes invalidated posters of already copied fireworks. Migration
`20260926000600` fixes both. Its SQL test checks a snapshot edit invalidates once,
a no-op does not invalidate, and a source-effect edit invalidates only its own
poster. Card poster identity now incorporates renderer source fingerprint and
capture dimensions, replacing the fixed `v2` cache label. Existing storage
objects are retained but obsolete captures are not displayed. The local working
database has migrations through `20260926000600`; production still uses the
manual release gate.

Remaining persistence work includes atomic editor save/history writes and complete
restored-history/save-failure UI coverage. Waterfall width and the launch/flash
`size` alias still depend on count and remain next in the control audit. Fresh
installation and emission conversion are verified; the overall editor/rendering
redesign is not complete or production-ready.

Final checks for this pass: `pnpm check` passed (608 app, 52 package and 11
database-tooling tests, production build). Seven pre-existing lint warnings
remain. A separate authenticated browser tab opened the converted Fountain
Default and showed 126 sparks per second, 7.8 seconds and Saved, without editing
or saving it. The temporary verification stack was stopped and removed after
its tests; the working local database and the user's browser tab remain running.

The import integration pass found that Python still emitted removed geometry
count multipliers, duration ranges, trail version and launch appearance mode.
Those payloads passed Python's tests but failed the app's strict renderer parser.
The worker now writes direct layer counts, fountain sparks per second and ground
emission duration. Roman candle counts come from observed ejections. Short
fountain windows use the renderer's 0.1-second lower bound. Pistils are spherical
designs with an explicitly enabled inner layer, not a separate geometry.

`pnpm test:import-contract` now exercises actual Python output through the app's
strict validator for all 19 supported geometries, including a pistil composition.
It simulates fountain rates of 12.5, 25 and 600 sparks per second with independent
durations, plus a four-shot Roman candle. CI's worker job runs this check alongside
the Python suite. Worker candidate provenance advances with the mapper; renderer
source bytes and the app/worker/database renderer fingerprint are unchanged.
Existing import evidence is not rewritten. The worker still requires deployment.

Waterfall width is now a distance in scene units, from 0 to 1,200. Both star layers
span that distance independently of count; a single star starts at the centre.
The previous layout also stopped one interval short of the right edge, so the
new distribution deliberately centres the curtain and includes both endpoints.
Scatter remains a separate, additive control. Import reconstruction derives width
from shape evidence independently of the candidate's star count.

The one-off converter copies the old count-dependent width into this explicit
field, including geometry presets and copied provenance, then removes the old
multiplier. Fresh-install snapshots and hashes are updated. The local conversion
changed 117 records, retained originals in
`.tmp/renderer-backups/waterfall-width-before-20260926.json`, and verified a second
pass has no pending changes. Migration `20260926000700` aligns the new renderer
fingerprint locally; production still needs coordinated rollout and evidence
revalidation.

Tests cover zero/136.4/1,200 width, 1/2/10/200 outer stars, an independent inner
layer, conversion idempotence and import count independence. Only the two waterfall
hashes changed among 48 seeded captures; all particle peaks and timing stayed the
same. `pnpm check` passed with 608 app, 54 package and 11 database-tooling tests,
plus the production build. All 68 worker tests, the import contract check, UI
audit, conversion transaction tests and eight local SQL suites passed. Browser
verification covered the converted 136.4 value, exact entry, keyboard adjustment
and one-step undo. Units now display without duplicating the editable value.

Launch speed now has an explicit 13.5 default rather than deriving it from outer
star count. Shell size is an independent value from 1 to 1,000, replacing its
count-dependent multiplier. Straight and guided shells honour that size without
random shrinking or a hidden 8–34 cap. Tiny shells therefore survive until the
burst. Distribution presets no longer change launch wobble, shell size or launch
particle density. The unused replay trail guide and its duplicated count/gravity
rules are removed; active multishot aim markers retain their own disposal helper.

The local launch conversion updated 123 records, retaining originals in
`.tmp/renderer-backups/launch-before-20260926.json`. It resolves missing flight
speed and shell multipliers once, preserves explicit values, converts copied
presets, and verifies a second pass is empty. Bootstrap data is updated, and
the local database, app and worker agree on migration `20260926000800`'s final
renderer fingerprint. Hosted environments still need the coordinated release.

Simulation tests cover all distributions, counts of 1 and 200, shell sizes of
1/27.5/110/500/1,000, guided drawing and a size-1 shell at maximum launch speed.
All 48 catalogue timings are unchanged; 42 appearance hashes changed as expected
from removing random launch mutations and separating launch randomness. Peak
counts rose above 10% for normal Brocade (+12%), Strobe (+64.9%) and Whirl (+33.8%),
and disabled-colour Strobe (+11%) and Whirl (+17%). A temporary in-memory
counterfactual restored only pattern-specific launch density: Strobe's peak fell
from 1,337 to 859 and Whirl from 1,477 to 1,062. These are intentional removal of
hidden preset suppression, not performance clearance. Explicit launch emission
rates and dense-show frame measurements remain required before release.

Browser checks verified saved size 110, exact size 1 and one-step undo. The full
app gate passed with 608 app, 57 package and 11 database-tooling tests, plus the
production build. Worker/import checks, UI audit, conversion transaction tests
and eight local SQL suites passed. Seven existing lint warnings remain.
The count-dependent scene flash and
the duplicate top-level `size` field remain to remove. Maximum flight time also
needs a defined outcome when it expires before apex, rather than a disappearing
carrier.

Scene flash now has its own 0–4 control, independent of star count. Zero leaves
other active flashes alone. Hemisphere lighting cannot dip below its ambient
level, and both hemisphere and point flashes fade by elapsed time. The duplicate
top-level `size` field and the misleading Auto burst report option are removed;
sound choices are None, Light and Heavy. Cue emphasis scales flash explicitly.

The one-off conversion updated 131 local records, preserving originals in
`.tmp/renderer-backups/scene-flash-before-20260926.json`, converting copied preset
provenance and verifying an empty second pass. Bootstrap data and hashes are
updated. Migration `20260926000900` aligns the app, worker and database fingerprint.
The new tests cover count-independent flash, zero intensity, weak flashes,
elapsed-time fading at different step sizes, copied geometry presets and
idempotent conversion. The final verification results are recorded at the top
of this document.

### Atomic editor persistence

All nine mutation entry points now use one permission-checked database transaction:
effect and firework updates/restores/inline presets, plus part-preset updates,
archives and restores. It locks the target, rejects stale revisions, builds
previous/current history snapshots from database rows and commits all writes
together. A history or inline-preset failure rolls back the record as well.
Firework history uses the resolved snapshot rather than retained original overrides.
Every edit receives a distinct monotonic revision. The superseded inline RPCs and
three duplicated history-write implementations have been removed.

A real browser save/reload exposed a separate stale baseline bug: detail readers
could return their cached pre-save record alongside fresh history. All three
editor detail readers now read the current record directly. List caching remains.
A disposable local effect passed two saves, immediate reopening with the latest
name, both persisted history entries and restore to the earlier version. The
fixture and its generated history were removed after verification.

The SQL suite checks all three target kinds, history failure after record/preset
writes, stale conflicts, protected fields, permission denial, restore ownership,
archives and inner-layer preset creation. Client tests reject incomplete or
mismatched save confirmations. Source guards now check transaction routing rather
than freezing the obsolete separate-write implementation. A fresh database through
migration `20260926001100` passed all nine SQL suites and generated-type checks.
Migration `20260926001200` corrects the snapshot helper's volatility annotation
to match PostgreSQL's JSON constructors. All nine local SQL suites and generated
types still pass. Database lint reports only the pre-existing unused `p_amount`
parameter in `reserve_ai_credits`; the new editor functions have no warnings.

Migration `20260926001000` updates the source fingerprint after unused import
helpers were removed. Simulation behaviour is unchanged, but evidence still needs
to match deployed source bytes. Coordinate schema/app/worker deployment and keep
admin writes gated during the switch: migration `20260926001100` replaces the old
inline save RPCs. Nothing has been merged or deployed by this task.

### Dense simulation verification

The reproducible CPU benchmark is `scripts/renderer/benchmark-dense.mjs`. It uses
the live engine's fixed-step update order, including deferring newly spawned
particles until the next tick. The older single-effect capture script iterates a
growing live list, so those captures alone do not establish live-engine performance.

The benchmark fires Brocade, willow, chrysanthemum, strobe, whirl and crossette in
rotation. The two fixtures fire 24 cues at 0.2-second intervals and 72 cues at
0.05-second intervals. Each runs for 20 seconds at 60 Hz across five seeds, with
100,000 slots, identical dependencies, a warm-up and alternating source order.
Catalogue defaults are taken from each source revision, so this compares the
delivered compositions rather than claiming identical visual workloads.

The [raw results](verification/dense-show-20260926.json) compare the extraction
checkpoint `e751023` with `af60fc7`, using Node 24.18.0 on an Apple M4 Pro.
Values below are medians across the five seeds. CPU timing excludes WebGL,
geometry uploads, lights, sound, snapshot caching and browser scheduling.

| Fixture             | Source                | Median active tick | Peak particles | Live slots overwritten |
| ------------------- | --------------------- | ------------------ | -------------- | ---------------------- |
| 24 overlapping cues | Extraction checkpoint | 0.623 ms           | 15,838         | 0                      |
| 24 overlapping cues | Current               | 0.661 ms           | 17,879         | 0                      |
| 72-cue finale       | Extraction checkpoint | 0.286 ms           | 50,303         | 17,939                 |
| 72-cue finale       | Current               | 0.230 ms           | 54,649         | 19,679                 |

The uncensored 24-cue case increases peak particles by 12.9% and median active
simulation time by 6.0%. The finale loses live particles in both implementations:
`ParticlePool.new()` advances a circular cursor and overwrites its next slot even
when other slots are free. A three-slot reproduction confirms this: keep slot 0
alive, reset slots 1 and 2, compact, then spawn again. The new particle replaces
slot 0 while two free slots remain. This is pre-existing behaviour, not evidence
that the refactor introduced the allocator defect. The increased current workload
does overwrite more live particles. The finale's lower CPU median therefore does
not clear its performance or visual correctness.

All runs finish with zero remaining particles. A repeated local pass gave the
same particle counts, while timings varied, as expected on a shared machine.
GPU measurements remain outstanding. No renderer or database changes were made
for this benchmark; the extracted comparison source stays in ignored local files.

To reproduce from the repository root with Node 24 and installed dependencies:

```sh
mkdir -p .tmp/dense-benchmark-baseline
git archive e751023 packages/fireworks/src | tar -x -C .tmp/dense-benchmark-baseline
ln -s ../../../../packages/fireworks/node_modules .tmp/dense-benchmark-baseline/packages/fireworks/node_modules
node scripts/renderer/benchmark-dense.mjs .tmp/dense-benchmark-baseline/packages/fireworks/src > .tmp/dense-benchmark.json
```

Omit the argument to measure only the current checkout. Do not compare these CPU
timings with browser frame timings or treat them as the 10% GPU acceptance gate.
