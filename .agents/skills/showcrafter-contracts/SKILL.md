---
name: showcrafter-contracts
description: Change ShowCrafter music analysis, firework rendering, import workers or contracts shared between the web app and Python services. Use for timing, reconstruction, schemas and cross-service verification.
---

# ShowCrafter contracts

The web app is `apps/web`; Python 3.11 services have separate requirements and
virtual environments under `services/`. Read the relevant service and its tests,
then the consumer, before changing a payload or timing model.

- Music analysis: `services/music-analyser/showcrafter.py`,
  `apps/web/lib/show-analysis-validation.ts` and the analyser pipeline helper in
  `apps/web/tests/helpers/`.
- Import reconstruction: `services/firework-import-worker/`,
  `apps/web/lib/import-reconstruction.ts` and `apps/web/lib/import-render-metrics.ts`.
- Renderer: `apps/web/lib/fireworks/`, the replay canvas and the import harness.

The renderer source paths are relative to `apps/web`. Its source list and bytes
are fingerprinted in `lib/fireworks/import-renderer-contract.ts`. Moving the
whole app preserves those relative paths. Changing a listed file or path requires
an intentional version update aligned across app, worker and database. Do not
refresh a fingerprint just to make a failing test green.

Keep renderer schema, defaults, editor controls, persistence, timing and tests
aligned. Preserve fixed-step capture and cue-safety invariants. Run `pnpm test:worker` for import/renderer changes and `pnpm test:analyser` for analysis
changes. When the analyser contract changes, also run:

```bash
SHOWCRAFTER_RUN_CROSS_LANGUAGE_CONTRACT=1 services/music-analyser/.venv/bin/python services/music-analyser/tests/test_schema_validation.py
```

Run the relevant Node tests and `pnpm check`. Keep any preview server stopped
while a build rewrites its output; use an isolated `NEXT_DIST_DIR` for concurrent
local previews. Local checks do not deploy Modal services or apply migrations.
