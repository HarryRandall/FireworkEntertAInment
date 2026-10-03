# Studio comparison and checks

Studio uses the shared editor frame and the renderer Viewer. Design, Compare and
Reference share the draft's firing-relative transport in seconds. Compare loads
the actual current published version under caller RLS; an effect without one has
an explicit empty pane. Preview-only layer visibility does not alter checks.

The published Viewer stays paused and follows the draft clock. It clamps at its
own duration. This keeps a shorter published firework on its final frame while
the draft continues. The draft's duration defines the shared scrubber, matching
the prototype. Only the draft emits sound.

Reference accepts a local video file through the file input or drop target. It
owns a browser object URL, revokes it on replacement/unmount and reports decoding
and playback failures. Nothing is uploaded. Leaving Reference releases the clip;
a reload requires selecting it again. Local clips start at zero. The named
`useMeasuredShotTimes` hook connects validated `video_analyses.shots` onset data to
the reference clock, using the first onset; no analysis query is made here.

## Particle measurements

The 22,000-particle phone budget comes from `studio.html`. A worker samples the
DOM-free CPU reference simulation at 30 Hz across the complete shot, including
sprays, heads, halos, flashes and smoke puffs. Quick adjustments are resolved by
the simulator. A new authored snapshot terminates obsolete work; errors never
report a pass. Over-budget measurement stops immediately and is labelled as a
lower bound. Other results are sampled peaks, not continuous-time maxima.

Missing names, consumer-cake height, long star burns and small bursts are advisory
checks. Only the particle budget blocks publication. These warnings are visual
editing guidance, not verified safety certification.

The catalogue publish action independently measures the stored draft. The
`publish_measured_effect_version` RPC checks the exact document under catalogue
publication locks, refuses stale or over-budget results, and delegates the normal
immutable publication lifecycle. It saves the sampled count, clock and provenance
in `checks.particles`. A document hash prevents an autosave-preserved old check
from becoming the summary peak of another design.

SQL validates authorised editor-supplied measurements; it does not run the
TypeScript simulator. The original catalogue publish RPC remains available to
existing trusted editor clients and retains nominal facts for unmeasured designs.
All application effect publication now uses the measured path.

## Composer acceptance

Run `pnpm test:browser -- tests/browser/studio-compare-reference.spec.ts` against
the composer's running app and seeded local Supabase. The suite signs in as admin,
creates independent copies and covers:

- Compare scrubber synchronisation and immutable published version identity.
- Decoding, seeking, play/pause and object URL cleanup with a generated local clip.
- The unpublished empty state and server refusal of a saved over-budget draft.
- Layers, chronological inspector tabs, undo/redo, autosave and Saved after reload.
- Refused non-admin access, desktop/390 px, light/dark, axe and document overflow.
- Per-section screenshots attached under `output/playwright/`.

The small clip is generated test data, documented in `tests/browser/fixtures/README.md`.
No browser or dev server is started by the implementation agent. The composer must
run these journeys, attach the screenshots and prototype comparison, and obtain
owner visual review.
