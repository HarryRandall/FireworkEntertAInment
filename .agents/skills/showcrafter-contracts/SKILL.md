---
name: showcrafter-contracts
description: Change ShowCrafter firework rendering, the design schema, music analysis, video import or any contract shared between the web app, the database and Python services. Use for timing, schemas and cross-service verification.
---

# ShowCrafter contracts

Read the producer, its tests and every consumer before changing a payload, schema or
timing model.

- **Renderer:** `packages/fireworks` owns the renderer, its DOM-free simulation and the
  design JSON Schema (`schema/design.v1.json`). The schema is the contract between the
  renderer, the database (`pg_jsonschema` checks on stored designs) and the app (Zod
  types generated from it). Change all three together, with a generated-file check.
- **Renderer version:** `RENDERER_VERSION` is a semver string exported by the package
  and stored as data on design versions and posters. There is no source fingerprint and
  no migration per renderer change. Bump it when output changes visibly.
- **Design versions:** stored designs are never rewritten in place. A schema change
  ships with `upgradeDesign()` and new versions through the normal publish path.
- **Determinism:** the simulation computes state from `(design, seed, t)` alone. Keep
  it free of DOM, time and accumulated state, and keep the CPU spray reference in step
  with the GPU path (parity tests).
- **Music analysis:** `services/music-analyser` writes `music_analyses`; its Pydantic
  schema, the planner's types and a shared fixture must agree. When the analyser
  contract changes, run the cross-language check as well as `pnpm test:analyser`.
- **Jobs:** workers claim and finish work through the `jobs` table RPCs only.

Run the package tests, the relevant service suite and `pnpm check`. Local checks do not
deploy Modal services or apply hosted migrations.
