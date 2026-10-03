# Fireworks design contract

`@showcrafter/fireworks` owns the stored design format. PR 2.1 provides the v1
JSON Schema, generated Zod validators and TypeScript types, version constants and
`upgradeDesign(doc, fromVersion)`. Simulation, WebGL, sound playback, posters and
catalogue templates arrive in later renderer PRs.

```ts
import { upgradeDesign, type Design, DESIGN_SCHEMA_VERSION } from '@showcrafter/fireworks';

const design: Design = upgradeDesign(storedDocument, DESIGN_SCHEMA_VERSION);
```

The package root and `./schema` expose the contract; `./schema/design.v1.json`
exposes the database schema. `./sim` and `./view` exports will be introduced with
those implementations, rather than pointing at absent files.

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
`RENDERER_VERSION` starts at `0.1.0`; no renderer output exists in this PR.

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
