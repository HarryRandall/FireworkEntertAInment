# Fireworks Engine V2

## Architecture

`FireworkReplayCanvas` now configures a mostly imperative `FireworksEngine` instead of keeping live burst arrays in React state. React passes cues and elapsed time; the engine owns scheduling, object pools, typed arrays, shader materials, trails, smoke, and deterministic scrub rebuilds.

Core modules live in `lib/fireworks`:

- `spec-v2.ts`: TypeScript-first Zod schemas for `FireworkEffectSpecV2`, products, show cues, shot sequences, launches, breaks, particle layers, smoke, flash, render profiles, and video observations.
- `spec-v3.ts`: CodePen-style standalone firework schema. It stores shell family, size, fuse/lift timing, palette, glitter, crackle, strobe, pistil, streamers, smoke, and reusable cue placement data.
- `legacy-adapter.ts`: migrates old `FireworkRenderSpec` data into v2. `trailLength` becomes real trail seconds/segments, `secondaryBursts` become sub-breaks, and legacy cue timing is preserved.
- `EffectCompiler.ts`: turns v3, v2, or legacy replay cues into deterministic launch/layer/flash/smoke events and emits shader attributes into pools.
- `FireworksEngine.ts`: owns GPU-friendly draw systems and deterministic forward/scrub playback.
- `ParticlePool.ts`, `GpuParticleSystem.ts`, `TrailSystem.ts`, `SmokeSystem.ts`: reusable typed-array-backed render systems.

## Adding Effects

Add new reusable effects in the database using `effect_specs.spec_json`. For local/manual seeding, start from `supabase/seed-codepen-fireworks-v3.sql`. The active library should not depend on hard-coded TypeScript presets.

Use v3 `shots` for cakes, fans, zippers, rows, and volleys. Do not fake these as one large burst. Shows can reuse one effect many times by adding multiple cue rows with different `time_seconds`, `position_json`, `rotation_json`, `scale`, and `effect_spec_id`.

## Database Model

Migration `0009_firework_effect_spec_v2.sql` adds the normalized effect tables, and `0010_effect_specs_v3_catalogue.sql` wires v3 catalogue/product references:

- `products`: queryable product metadata and default effect link.
- `effect_specs`: queryable spec headers plus flexible versioned `spec_json`.
- `show_cues` v2 columns: `effect_spec_id`, `firework_product_id`, spatial position/rotation JSON, overrides, track/layer, lock, and seed override.
- `inferred_video_observations`: stores video observation JSON linked to an effect spec.

The existing `firework_specifications` path remains supported. Server parsing detects `version: 3` and `version: 2`; otherwise it returns the old legacy spec and the renderer migrates it at runtime.

## Video/LLM Ingestion

The worker should output structured inference, not frames or per-frame drawing instructions. The accepted envelope is:

```json
{
  "name": "Detected effect name",
  "description": "Short product/effect summary",
  "durationSeconds": 8.5,
  "confidence": 0.78,
  "effectSpec": { "version": 3 },
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

`lib/imports.ts` accepts v3, v2, and old legacy `renderSpec` envelopes. Old outputs are migrated for preview; approved imports now publish the versioned `effectSpec` into `effect_specs`.

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
