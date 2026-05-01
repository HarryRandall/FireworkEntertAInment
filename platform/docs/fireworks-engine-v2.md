# Fireworks Engine V2

## Architecture

`FireworkReplayCanvas` now configures a mostly imperative `FireworksEngine` instead of keeping live burst arrays in React state. React passes cues and elapsed time; the engine owns scheduling, object pools, typed arrays, shader materials, trails, smoke, and deterministic scrub rebuilds.

Core modules live in `lib/fireworks`:

- `spec-v2.ts`: TypeScript-first Zod schemas for `FireworkEffectSpecV2`, products, show cues, shot sequences, launches, breaks, particle layers, smoke, flash, render profiles, and video observations.
- `legacy-adapter.ts`: migrates old `FireworkRenderSpec` data into v2. `trailLength` becomes real trail seconds/segments, `secondaryBursts` become sub-breaks, and legacy cue timing is preserved.
- `EffectCompiler.ts`: turns replay cues into deterministic launch/layer/flash/smoke events and emits shader attributes into pools.
- `FireworksEngine.ts`: owns GPU-friendly draw systems and deterministic forward/scrub playback.
- `ParticlePool.ts`, `GpuParticleSystem.ts`, `TrailSystem.ts`, `SmokeSystem.ts`: reusable typed-array-backed render systems.
- `effectPresets.ts`: 24 validated v2 presets covering shells, mines, comets, cakes, zippers, W patterns, reloadable sequences, and finale volleys.

## Adding Effects

Add new reusable effects in `lib/fireworks/effectPresets.ts` using `shellPreset`, `cakePreset`, or a new factory if the product needs a distinct structure. For product data from the database, store the full validated `FireworkEffectSpecV2` JSON in `effect_specs.spec_json` or the existing `firework_specifications.spec` compatibility column.

Use `shotSequence` for cakes, candles, fans, zippers, rows, and volleys. Do not fake these as one large burst. Each shot can override launch height, pan/tilt, mine-at-launch, break layers, colours, and seeds.

## Database Model

Migration `0009_firework_effect_spec_v2.sql` adds:

- `products`: queryable product metadata and default effect link.
- `effect_specs`: queryable v2 spec headers plus flexible `spec_json`.
- `show_cues` v2 columns: `effect_spec_id`, `firework_product_id`, spatial position/rotation JSON, overrides, track/layer, lock, and seed override.
- `inferred_video_observations`: stores video observation JSON linked to an effect spec.

The existing `firework_specifications` path remains supported. Server parsing detects `version: 2`; otherwise it returns the old legacy spec and the renderer migrates it at runtime.

## Video/LLM Ingestion

The worker should output structured inference, not frames or per-frame drawing instructions. The accepted envelope is:

```json
{
  "name": "Detected effect name",
  "description": "Short product/effect summary",
  "durationSeconds": 8.5,
  "confidence": 0.78,
  "effectSpec": { "version": 2 },
  "observations": {
    "observedEvents": [],
    "inferredShotSequence": {},
    "inferredEffectLayers": [],
    "unknowns": [],
    "suggestedManualReviewFields": [],
    "confidence": 0.78
  }
}
```

`lib/imports.ts` accepts both new v2 envelopes and old legacy `renderSpec` envelopes. Old outputs are migrated for preview; approved imports now publish the v2 `effectSpec`.

## Quality And Performance

The shader path uses analytic motion:

`position = origin + velocity * dragApprox(age) + acceleration * age^2 * 0.5 + wind/curl`

Particle attributes are seeded and deterministic: spawn time, lifetime, origin, velocity, acceleration, drag, sizes, colours, alpha curve, twinkle/strobe params, emissive intensity, and seed. Trails are currently delayed analytic particles, which makes `trailLength` visible while keeping draw calls low. Smoke uses a separate normal-transparent system.

Tune quality through `renderProfile` and engine capacities:

- Lower `particleCount`, `maxParticles`, and `maxTrailSegments` for previews.
- Use shorter `trail.lengthSeconds` and fewer `segmentCount` values for low-end devices.
- Keep smoke counts modest because transparent overdraw is expensive.
- Prefer several purposeful layers over one huge layer; it looks better and scales more predictably.

Use `<FireworkReplayCanvas debug />` to inspect scheduled events and live pool counts during development.
