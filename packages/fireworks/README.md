# Fireworks design contract

`@showcrafter/fireworks` owns the stored design format. PR 2.1 provides the v1
JSON Schema, generated Zod validators and TypeScript types, version constants and
`upgradeDesign(doc, fromVersion)`. PR 2.2 adds the DOM-free shell core. PR 2.2a adds
stored quick adjustments and their shared resolver. Other kinds, modifiers, sprays, WebGL, sound
playback, posters and catalogue templates arrive in later renderer PRs.

```ts
import { upgradeDesign, type Design, DESIGN_SCHEMA_VERSION } from '@showcrafter/fireworks';

const design: Design = upgradeDesign(storedDocument, DESIGN_SCHEMA_VERSION);
```

The package root and `./schema` expose the contract; `./sim` exposes the simulation; `./schema/design.v1.json`
exposes the database schema. `./view` will be introduced with its implementation.

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
`RENDERER_VERSION` starts at `0.1.0` for this initial renderer port.

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
prototype's constant `head.brightness` is the same value at 0 and 1. The renderer
will apply the break's `fade` separately: star-specific `white_hot`, warm shift
from `ember_at`, linear alpha fade from `fade_at`, the final 0.92 wink-out, and
orange ignition for `prime_s`. Keeping these tunable fade parameters preserves
the prototype exactly, including its per-star white-hot variation and seconds-based
ignition, which cannot be baked into one universal gradient. Modifiers then alter
the per-star brightness and motion. Their execution order is specified in PR 2.3.

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
| `shot.seed`                                                                                                                | Root default `seed`, with future playback overrides per tube                                                     |
| `shot.pos`, `t0`, `muzzle`, viewer settings, poster framing, props                                                         | Playback/composition/view inputs outside the effect design                                                       |
| `DEFAULTS`, `WIND`, global density/lifetime factors                                                                        | Built-in renderer tuning, not authored fields                                                                    |
| Editor spec seed, envelopes, colours, modifiers, sound                                                                     | Seed; stops and brightness curve; per-layer modifiers; required sound gain block                                 |
| Editor spec adjectives, calibre, house-rule switches, sequence/product refs, unimplemented shapes, variation distributions | Proposed editor/catalogue features, not read by this renderer; omitted from PR 2.1                               |

The schema includes the plan's future `split`, `glitter`, `whistle` modifiers and
pattern names alongside the actual prototype cases. This PR validates their shape;
it does not implement them. It neither converts all presets (PR 2.10) nor claims
rendered parity (PRs 2.2 onwards). Database checks using `pg_jsonschema` begin in 3.3.

## Core simulation (PR 2.2)

```ts
import { simulate, shotDuration, ParticleKind } from '@showcrafter/fireworks/sim';

const particles = simulate(design, 3.0, { seed: 11 });
const duration_s = shotDuration(design);
```

Pass a validated v1 `Design` directly. `simulate(design, time_s, options?)` returns
fresh, tightly sized `Float32Array`s for `positions` and linear RGB `colours`
(three components per particle), `sizes`, `alphas`, and a `Uint8Array` of `kinds`.
Kinds are `ParticleKind.Spark`, `Head`, `Halo` and `Flash`. Sizes retain the
prototype's shader inputs. Heads already expand into a head quad and optional halo;
a future view must not expand them again. Sparks come first, followed by quads,
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

This PR renders **shells with sphere or random directions**. It includes launch
head paths (all 14 styles, including jitter, wobble, spin and strobing climbs),
core flashes, core sparks/ring, star motion, colour/brightness curves, reignition
and burn fades. Layer modifiers are deliberately ignored in this core frame,
including those in the multi-break fixture. Other kinds and special patterns throw
a clear error until PR 2.3. Launch embellishment particles (rocket flame, rising
blossoms and crackle pellets), trails and smoke are deferred with the later kinds,
modifiers and spray work. No complete visual parity is claimed at this stage.

`shotDuration` already handles all stored kinds and includes break/layer delays,
varied star lifetimes, trail tails and modifier tail allowances. For multiple
modifiers it takes the longest allowance, rather than adding unrelated tails.
The pure helpers `hash`, `rgb`, `colourAt`, `brightnessAt`, `unit`, `directions`,
`launchPos` and `starPos` are available without a browser. `starPos` is the base
closed-form drag/gravity motion; it does not apply modifiers.

### Capturing golden numbers

The capture script executes the reference JavaScript in a Node VM with browser
stubs, removes unused browser imports, disables sprays/smoke and removes layer
modifiers after capturing duration. Its one-off v1-to-prototype field mapping is
only for the reference harness, never part of the runtime. The prototype's maths
is unchanged; per-break core/fade values replace its global lookups. Launch
embellishment particles are disabled for the launch-head cases.

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
Comet positions are captured for PR 2.3; PR 2.2 asserts its duration only.
Float32 comparisons use an absolute tolerance of 0.000001; analytical motion
checks use 0.000000000001. Scrub determinism compares arrays exactly.
