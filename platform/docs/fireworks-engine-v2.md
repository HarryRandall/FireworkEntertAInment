# Fireworks Engine

## Architecture

`FireworkReplayCanvas` configures a mostly imperative `FireworksEngine` instead of keeping live burst arrays in React state. React passes cues and elapsed time; the engine owns scheduling, object pools, shader materials, trails, smoke, audio reports, and deterministic scrub rebuilds.

Core modules live in `lib/fireworks`:

- `spec.ts`: shared runtime cue and render types.
- `design.ts`: validates, normalises, and compiles catalogue render JSON into a `FireworkDesign`.
- `effect-catalogue.ts`: source of truth for the generated reference catalogue.
- `Effects.ts`: turns a compiled design into launch, trail, burst, smoke, and audio behaviour.
- `FireworksEngine.ts`, `Scheduler.ts`, `ParticlePool.ts`, `World.ts`, and `SoundHandler.ts`: own deterministic playback, scene setup, and reuse of render/audio resources.

## Adding Effects

Add reusable reference effects in `lib/fireworks/effect-catalogue.ts`, then regenerate the clean catalogue reseed migration with `node scripts/seed/generate-firework-catalogue-migration.mjs` from `platform`. The generated migration upserts `firework_effects` and `fireworks`; it should not reintroduce legacy `effect_specs`, `product_shots`, or `fib-*` seed rows.

Use `multishots` and `multishot_fireworks` for cakes, fans, zippers, rows, and volleys. Do not fake these as one large burst. Shows can reuse one catalogue item many times by adding multiple timeline rows with different `time_seconds`, `track`, `layer`, `launch_position_index`, `label`, `locked`, `seed_override`, and `catalogue_item_id`.

## Database Model

The current catalogue schema uses the 2026-06-14 catalogue rework plus later editor migrations:

- `firework_effects`: reusable base effect families with validated `model_json`.
- `fireworks`: colour and render variants linked to a base effect.
- `multishots` and `multishot_fireworks`: ordered composite products that expand into replay cues.
- `catalogue_items`: purchasable items pointing at either a firework or multishot.
- `show_timeline_items`: cue rows consumed by the replay and generation flows.
- `firework_style_defaults`, `firework_effect_style_default_links`, and `firework_style_default_links`: admin-managed reusable defaults for editor sections.

Server reads should go through `lib/shows.server.ts` and `lib/shows/*` mappers so multishot expansion, style-default hydration, and cache invalidation stay consistent.

## Video/LLM Ingestion

The worker should output structured inference, not frames or per-frame drawing instructions. The accepted envelope is validated in `lib/import-jobs.ts` and approved through the admin import actions:

```json
{
  "name": "Detected effect name",
  "description": "Short product/effect summary",
  "durationSeconds": 8.5,
  "confidence": 0.78,
  "spec": { "version": 3 },
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

Approved imports create or update catalogue effects/fireworks, compile their render design with `compileFireworkDesign`, and invalidate the admin plus show catalogue caches.

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
