# Fireworks design contract

`@showcrafter/fireworks` owns the stored design format and its deterministic,
DOM-free particle simulation. It contains the v1 JSON Schema, generated Zod
validators and TypeScript types, design-version validation, stored quick
adjustments, duration calculation, and particle generation for shell and ground
effects. CPU sprays, trails, launch embellishments and smoke are included.

```ts
import { upgradeDesign, type Design, DESIGN_SCHEMA_VERSION } from '@showcrafter/fireworks';

const design: Design = upgradeDesign(storedDocument, DESIGN_SCHEMA_VERSION);
```

The package root and `./schema` expose the contract; `./sim` exposes the simulation;
`./schema/design.v1.json` exposes the database schema.

## Validation and generation

`schema/design.v1.json` is the source of truth, using JSON Schema draft 7 for
`pg_jsonschema`. Every object is closed. Required fields must be stored explicitly;
`default` is an authoring annotation, never a repair performed by validation.
`head.halo` is optional because its prototype default depends on strobe. Colour
reignition is optional and applies only to colour changes.

`upgradeDesign` supports version 1 only and returns a validated deep copy with the
same values. It does not mutate the document or apply defaults. Invalid documents
throw a Zod error containing property paths; unknown versions throw a range error.
The version is stored externally as `design_schema`, not inside the document.
`RENDERER_VERSION` is `0.4.0` for the CPU sprays and smoke port.

## Quick adjustments

`adjustments` is an optional map of Finale-style levels from `-3` to `+3`, retained
with the authored design. Keys are checked against the package registry. Shell keys
cover launch height, tail and climb, and break flash and core ring. Layer keys use the
stable layer id, for example `layer.l1.burn` or `layer.l1.trail.glitter`. Ground keys
cover the compatible comet, tourbillon and fountain values.

Use `resolveDesign(design)` before reading physical fields outside the renderer. The
simulation and duration calculation resolve automatically. Height adjustments preserve
climb speed by scaling climb time by the square root of the height factor. The resolver
returns a new design and never mutates the saved document.

Zod is generated with
[json-schema-to-zod](https://github.com/StefanTerdell/json-schema-to-zod), pinned in
the package manifest. The script preserves local definition references and emits
a root discriminated union. It removes defaults before generation to avoid the
generator's optional-default behaviour changing what the JSON Schema accepts.

```sh
pnpm --filter @showcrafter/fireworks generate:schema
pnpm --filter @showcrafter/fireworks check
pnpm test:packages
pnpm check
```

Commit the JSON Schema and generated file together. `check:schema` compares the
complete generated output; a stale file fails the root package checks and CI.
Package checks also lint, typecheck, validate fixtures in both Ajv and Zod, and
exercise invalid documents, pure upgrades and stale generation in a temporary
copy. The three fixtures are hand-written, not catalogue template conversion.

## Stored shape and units

The root `kind` discriminates the document. `shell`, `mine` and `rocket` require
`launch`, non-empty `breaks` and `ground: null`. `comet`, `candle`, `fountain`,
`tourbillon`, `wheel` and `spinner` require `launch: null`, empty `breaks`, and a
`ground` object with the same `kind` and exactly one matching parameter block.
`candle` uses `ground.comets` for timed comet sequences; `rocket` uses shell breaks
and a rocket launch tail. The prototype's rocket and candle presets are encoded
as shell and comet already; the explicit aliases are supported for storage.

`break.at_s` is an offset from the launch apex, or firing time for a mine. Group
prototype layers sharing a `delay` into a break with that `at_s`, copying its core
and fade. Layer `delay_s` is then zero; it can separately express a delayed star
ignition within a break. Layer offsets stay relative to that break centre. Layer
IDs are stable authoring identifiers, not array indices or random values.

Physical fields use `_m`, `_s`, `_deg`, `_rad_s`, `_hz`, `_per_s` or `_m_s2`.
Dimensionless controls keep their names. In particular, layer `tilt` is the
prototype's dimensionless ring control, core `radius` is a radius fraction,
launch `spread` is a style multiplier, and fountain `cone` is a vector multiplier.
Fountain `height_m` is emitter height, not plume height. Wheel spin is revolutions
per second; spinner, tourbillon and comet spin are radians per second. Positive
drag and lifetimes avoid division by zero in the prototype's closed-form maths.
Ranges include the actual renderer presets, rather than the editor spec's
uncalibrated guesses (for example fountain rates exceed its 600 sparks/s maximum).

## Colour, brightness and fades

Each colour stop is `[normalisedLife, hexOrPalette]`. A palette is an array of hex
colours. Scalar values broadcast to every star. For palette values, `solid` selects
the first entry, `alternate` cycles by star index, `random` selects by seed, and
`per_star` assigns the explicit star index. Palette indices remain consistent
across stops. Stop times are ordered, start at 0 and finish at or beyond 1; late
transitions may finish after the burn ends. Adjacent equal times encode a step.
Palette entries at successive stops should retain the same order and count.
These cross-entry authoring conventions, and layer ID uniqueness, are not enforced
by draft 7's structural validation.

A constant palette uses the same value at 0 and 1. A prototype `changeTo` at `a`
becomes the original palette at 0 and `a`, then the target at `a + 0.08` for shell
stars (`a + 0.1` for comets), held to the end if the change ends before 1.
`colour.reignition: { at: a, duration: 0.1, amount: 0.5 }` preserves the shell's
brief brightness flare; omit it for a comet, which has no change flare. A ghost
uses a step at `a` instead of a blend, with its modifier shifting the change
across the burst by direction, `amount` and `gap`, and producing the dark dip.
This is one stored format, not a separate renderer model or app converter.

`brightness` is a piecewise linear multiplier curve over normalised life. The
prototype's constant `head.brightness` is the same value at 0 and 1. The simulation
applies the break's `fade` separately: star-specific `white_hot`, warm shift
from `ember_at`, linear alpha fade from `fade_at`, the final 0.92 wink-out, and
orange ignition for `prime_s`. Keeping these tunable fade parameters preserves
the prototype exactly, including its per-star white-hot variation and seconds-based
ignition, which cannot be baked into one universal gradient. Modifiers then alter
the per-star brightness and motion. Modifiers execute in stored order within their
defined motion and brightness phases.

## Prototype field audit

Read from the reference checkout: `design`, `layer`, `trail`, direction helpers,
`shotDuration`, `starPos`, `spray`, every `fill*` function, crossette/crackle,
props, framing, sound events and `developedTime`, plus `editor-spec.json`. An
in-memory inventory of all 99 presets found seven runtime kinds and 14 launch
styles. No prototype file or converted preset was copied into this checkout.

| Prototype field                                                                                                            | Stored v1 field or decision                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `kind`                                                                                                                     | Root discriminator; all seven runtime kinds plus `rocket` and `candle`                                           |
| `name`, `group`, `key`                                                                                                     | Catalogue/template metadata, dropped from renderer input                                                         |
| `launch.height`, `time`, `tilt`, `style`                                                                                   | `launch.height_m`, `time_s`, `tilt_deg`, `tail`                                                                  |
| `launch.sparks`, `spread`, `smoke`                                                                                         | Same names; spread remains a style multiplier                                                                    |
| Height scaling in `design()`                                                                                               | Store the final scaled `time_s`, no implicit rescaling on load                                                   |
| Root `layers`, `core`, `fade`                                                                                              | `breaks[].layers`, `core`, `fade`                                                                                |
| Layer `delay`                                                                                                              | Group into `break.at_s`; independent ignition uses `layer.delay_s`                                               |
| Layer `offset`, `radius`, `drag`, `gravity`, `life`                                                                        | `offset_m`, `radius_m`, `drag_per_s`, `gravity_m_s2`, `life_s`                                                   |
| Layer `name`, `pattern`, `count`, `tilt`, `speedVar`, `lifeVar`, `flash`, `hidden`                                         | Same names, with `speed_var` and `life_var`; add stable `id`                                                     |
| Layer `twist`                                                                                                              | A `twist` modifier's `angular_speed_rad_s`                                                                       |
| `colours`, `colourMode`, `changeTo`, `changeAt`                                                                            | `colour.mode`, palette-capable gradient `stops`, optional `reignition`; ghost uses a step                        |
| `head.brightness`                                                                                                          | Layer `brightness` curve, constant for the prototype                                                             |
| `head.size`, `visible`, `halo`                                                                                             | Same names; optional halo preserves contextual default                                                           |
| `trail.sparks`, `size`, `flicker`, `colour`, `glitter`, `fork`                                                             | Same names; colour is `house`, `star` or hex                                                                     |
| `trail.length`, `spread`, `gravity`, `drag`, `glitterDelay`                                                                | `length_s`, `spread_m_s`, `gravity_m_s2`, `drag_per_s`, `glitter_delay_s`                                        |
| `effect.kind`, `at`, `count`, `amount`, `spread`, `gap`                                                                    | `modifiers[]` with the same fields; `none` becomes no modifier                                                   |
| `effect.rate`                                                                                                              | `rate_hz` for strobe/twinkle, `rate_rad_s` for fish; other effects retain unused defaults                        |
| `core.enabled`, `colour`, `count`, `radius`, `flash`, `ring`, `flashOn`                                                    | Same fields, with `flash_on`; radius remains a fraction                                                          |
| `fade.whiteHot`, `emberAt`, `fadeAt`, `prime`                                                                              | `white_hot`, `ember_at`, `fade_at`, `prime_s`                                                                    |
| Root `comets`                                                                                                              | `ground.comets` for `comet` or `candle`                                                                          |
| `comets.count`, `pattern`, `size`, `sparks`, `glitter`, `pop`, `halo`, `whistle`                                           | Same fields, including `sequence` and `sweep` patterns                                                           |
| `comets.colour`, `colours`, `changeTo`, `changeAt`                                                                         | `comets.colour` gradient; original palette cycles by star index                                                  |
| `comets.spread`, `height`, `time`, `gap`, `tailLife`, `spin`, `spinR`                                                      | `spread_deg`, `height_m`, `time_s`, `gap_s`, `tail_life_s`, `spin_rad_s`, `spin_radius_m`                        |
| `comets.trail`, `split.count`, `split.distance`, `split.life`                                                              | `trail` and nullable `split: { count, distance_m, life_s }`                                                      |
| Root `fountain`                                                                                                            | `ground.fountain`                                                                                                |
| `fountain.duration`, `rate`, `speed`, `life`, `height`, `spacing`, `dir`                                                   | `duration_s`, `rate_per_s`, `speed_m_s`, `life_s`, `height_m`, `spacing_m`, `direction`                          |
| `fountain.colour`, `cone`, `emitters`, `streak`, `size`, `flicker`, `glitter`, `fork`, `glow`                              | Same names                                                                                                       |
| `fountain.gravity`, `drag`, `glowAlpha`                                                                                    | `gravity_m_s2`, `drag_per_s`, `glow_alpha`                                                                       |
| Root `tourbillon`; `height`, `time`, `radius`, `spin`, `count`, `sparks`                                                   | `ground.tourbillon`; `height_m`, `time_s`, `radius_m`, `spin_rad_s`, `count`, `sparks`                           |
| Root `wheel`; `radius`, `height`, `spin`, `duration`, `drivers`, `colour`, `sparks`, `glitter`                             | `ground.wheel`; `radius_m`, `height_m`, `spin_hz`, `duration_s`, other names unchanged                           |
| Root `spinner`; `duration`, `spin`, `wander`, `count`, `sparks`, `colours`                                                 | `ground.spinner`; `duration_s`, `spin_rad_s`, `wander_m`, other names unchanged                                  |
| Launch-style table fields                                                                                                  | Built-in style tuning selected by `launch.tail`, not a second stored design format                               |
| `spray` options (`speedDist`, `streak`, `fork`, `glitterDelay`, `alphaAt`, `inherit`, `cluster`, `dir`, `cone`)            | Keep the prototype's internal source maths; expose the design inputs above, no stored callback or particle state |
| `shot.seed`                                                                                                                | Root default `seed`, with optional playback overrides per tube                                                   |
| `shot.pos`, `t0`, `muzzle`, viewer settings, poster framing, props                                                         | Playback/composition/view inputs outside the effect design                                                       |
| `DEFAULTS`, `WIND`, global density/lifetime factors                                                                        | Built-in renderer tuning, not authored fields                                                                    |
| Editor spec seed, envelopes, colours, modifiers, sound                                                                     | Seed; stops and brightness curve; per-layer modifiers; required sound gain block                                 |
| Editor spec adjectives, calibre, house-rule switches, sequence/product refs, unimplemented shapes, variation distributions | Editor and catalogue concerns not read by this renderer                                                          |

The schema accepts `split`, `glitter` and `whistle` modifiers and the supported
pattern names. The simulation evaluates split child heads and exposes glitter tail
controls; whistle remains a stored sound cue. The schema is directly usable by
database validation with `pg_jsonschema`.

## Simulation

```ts
import { simulate, shotDuration, ParticleKind } from '@showcrafter/fireworks/sim';

const particles = simulate(design, 3.0, { seed: 11 });
const duration_s = shotDuration(design);
```

Pass a validated v1 `Design` directly. `simulate(design, time_s, options?)` returns
fresh, tightly sized `Float32Array`s for `positions` and linear RGB `colours`
(three components per particle), `sizes`, `alphas`, and a `Uint8Array` of `kinds`.
The separate `smoke` structure contains `positions`, linear `colours`, `sizes`,
`alphas`, `seeds` and `ages`, all tightly sized Float32 arrays. Smoke uses normal
blending in the consuming view and never joins the additive particle list. Puff seeds
and ages are noise shader inputs. Smoke retains the prototype's 6,000
puff cap, 0.003 alpha cut-off and ground clearance of half the puff size.

Kinds are `ParticleKind.Spark`, `Head`, `Halo` and `Flash`. Sizes retain the
prototype's shader inputs. Heads already expand into a head quad and optional halo;
the consuming view must not expand them again. Sparks come first, followed by quads,
with the prototype's independent 140,000 point and 24,000 quad caps and 0.004 alpha
cut-off. Returned arrays share no mutable storage with later calls.

Time is seconds from firing. Negative times are empty; non-finite times throw.
Options are an optional `seed` override, horizontal `position: [x, z]` in metres,
and `muzzle_m` (default 1.8). A zero seed retains the prototype's fallback to 1.
The launch reaches `launch.height_m` at the stored `launch.time_s`; there is no
implicit height scaling. Breaks start at apex plus `break.at_s`, with additional
`layer.delay_s`. Layer offsets are relative to the break centre. Flattened layer
indices, including hidden and not-yet-started layers, preserve the prototype seeds
across breaks. IDs remain authoring identifiers. Each break uses its own core/fade.

The simulation renders shell and rocket launches/breaks, mine cone bursts from the
muzzle, comet and candle heads and sprays (straight, fan, random, sequence and sweep), wheel
rim drivers and sprays, wandering spinners, fountain jets and muzzle glow, and tourbillon helices.
Every kind resolves stored adjustments before evaluating physical fields. Rockets
use the authored launch tail; candles use the authored comet pattern. The aliases
never override saved values.

Patterns preserve the prototype's ring tilt, heart outline, spiral arms, cone,
random upward directions and bottom horsetail directions. Palm is a sparse `sphere` layer;
horsetail is `bottom` with its authored drag/gravity. Those are looks rather than
additional schema pattern names. The schema-only `double_ring`, `fan`, `straight` and `sequence` layer patterns retain
the prototype's
sphere fallback (the corresponding ground comet patterns have their own paths).

Modifier composition is explicit in `sim/modifiers.ts`: twist rotations first,
then additive fish/bees/flutter motion; ghost shifts the stored colour transition
and dark dip; burn fade precedes strobe/twinkle/flutter brightness operations in
stored array order. Parent termination uses the earliest non-continuous crackle or
split trigger. Crackle, crossette/split and pop child events are emitted independently
and may outlive the parent. Repeated modifiers compose in array order within each
phase. Strobes emit sharp points and glints, with a default zero halo. Crossette
children use the combined parent path's velocity. Ghost suppresses colour reignition.

Glitter contributes clamped intensity and delayed ignition through `trailControls`.
It has no independent head particle in the prototype. `whistle` is retained for the
sound controls. Every kind now has its CPU sprays, including multi-emitter
fountains, wheel and spinner trails, and tourbillon helices. Launch flame, rising
blossoms and climb crackle are included.

### CPU sprays and smoke

`sim/spray.ts` separates `spraySlots(start, end, now, options)` from `sparkState`.
Slots contain a stable ID, emission time, age and lifetime. The source clock sets
the slot index, so seeking never reseeds a spark. The CPU samples the source at
birth, computes inherited velocity using a backward difference within the last
16 ms of emission, and fixes `alphaAt` at birth. `sparkState` receives those values
and writes into caller-owned Float64 storage. It has no callbacks, allocations or
closures, and uses fixed loops: three colour channels, four fork children and at
most sixteen streak points. Its output stride is eight: x/y/z/r/g/b/size/alpha.
The caller needs storage for seventeen rows; the return value is the written count.
This kernel and the Float32 direction table are the reference for GLSL evaluation. Source paths and scheduling remain on the CPU here.

The CPU reference retains gerb speed distribution, streaks, fork termination,
delayed glitter, flicker, birth alpha, inheritance, clustering and directed cones.
Star trails stop at the earliest terminating modifier or 92% of burn life and can
outlive invisible heads. Split/crossette children carry independent tails with the
prototype's source-clock indexing. Strobe trails use 0.25 alpha; twinkle trails use
constant alpha; other trails keep their burn alpha at birth. Multiple glitter
modifiers resolve in stored order through the shared control hook.

Smoke includes muzzle billows, climb puffs, burst clouds, comet muzzle smoke and
large flare smoke. The prototype's `WIND = 0.9` m/s and its transient warm/colour
tints are retained. `{ smoke: false }` skips smoke generation. Diagnostic options
`sprays: false` and `launchEffects: false` isolate heads/discrete events for the
older goldens; all three components are enabled by default.

Fixed-time spark budgets (including forks and streak points) are tested for the
small cases in `tests/spray-cases.mjs`: shell 3,000; comet 400; fountain 7,000;
wheel 2,000; spinner 500; tourbillon 650; four-emitter fountain line 13,000.
These are fixture budgets, not a claim about every design or GPU frame time.

`shotDuration` already handles all stored kinds and includes break/layer delays,
varied star lifetimes, trail tails and modifier tail allowances. For multiple
modifiers it takes the longest allowance, rather than adding unrelated tails.
The pure helpers `hash`, `rgb`, `colourAt`, `brightnessAt`, `unit`, `directions`,
`launchPos` and `starPos` are available without a browser. `starPos` is the base
closed-form drag/gravity motion; it does not apply modifiers.

### Capturing golden numbers

The capture script executes the reference JavaScript in a Node VM with browser
stubs and removes unused browser imports. Core/kind regressions disable sprays and
smoke; the additional `sprays` cases retain both. The original core cases remove layer
modifiers after capturing duration; the added kind/modifier cases retain them. Its one-off v1-to-prototype field mapping is
only for the reference harness, never part of the runtime. The prototype's maths
is unchanged; per-break core/fade values replace its global lookups. Launch
embellishment particles are disabled for the original launch-head cases and enabled
for the full spray cases. Stored trail units and glitter controls are mapped only
in this independent reference harness.

Run from the repository root with Node 24:

```sh
node packages/fireworks/scripts/capture-core-goldens.mjs /Users/harry/projects/FireworkEntertAInment-reference/docs/design/redesign-2026-09/prototype/fireworks3d.js
pnpm exec prettier --write packages/fireworks/tests/fixtures/core-goldens.json
pnpm --filter @showcrafter/fireworks check
```

Commit the script and `tests/fixtures/core-goldens.json` together. Capturing is a
manual operation that reads the reference checkout; CI only reads the committed
numbers. The fixture records the reference SHA-256 for provenance, not as a
renderer version or runtime contract. Shell samples check counts and sampled
positions, colours, sizes, alphas and kinds at launch, flash, developed burst,
late burn and end. Tests also cover all launch-head styles and core rings.
The `kinds` cases cover all nine stored kinds, each modifier, the prototype burst
patterns, continuous crackle, ground comet patterns and comet pop/split. Inputs are
small test cases in `tests/kind-cases.mjs`, not catalogue template conversion. The full spray captures
cover all nine stored kinds, every launch tail, split child tails, gerb streaks,
forks, delayed glitter, colour changes, hidden heads, multi-emitter fountains and
muzzle/climb/burst/flare smoke, including puff seeds and ages. The prototype allows
one modifier per layer: reference cases use that restriction, while composition
has separate behavioural tests. Sound playback is outside the simulation. Golden
comparisons sample particles and counts at several times, alongside exact scrub,
placement, seed, adjustment resolution and combined-modifier behaviour tests.
Float32 comparisons use an absolute tolerance of 0.000001; analytical motion
checks use 0.000000000001. Scrub determinism compares arrays exactly.
