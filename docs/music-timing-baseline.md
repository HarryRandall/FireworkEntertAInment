# Music timing model: baseline and first implementation

This baseline describes the local implementation and tests. It does not claim physical measurement accuracy or online deployment acceptance.

## Existing flow

Fixed QR assortment → music analysis → shared cue slots → fast / beat / LLM planning → safety and exact-quantity validation → quality checks and beat fallback → persistence → child-shot expansion and music preview.

The analyser provides beats, downbeats, onsets, energy, sections, key moments, buildups, finale metadata, music features, and show personality. The beat-grid builder uses only the subset needed for slots, density, and emphasis. The prompt provides compact analysis context to the LLM, but analyser prose is never treated as product physics.

## Timing boundaries

Single-shot launch time is derived from the estimated impact time and renderer design. Multishot products align the sequence start to the slot; this does not promise that the first child impact is on the beat.

Catalogue child timing comes from `multishot_fireworks`: sequence index, offset, pan, tilt, position, calibre, and resolved firework specification. Replay expands the parent cue by those offsets. A parent product duration and shot count alone cannot reconstruct the child rhythm.

Renderer timing estimates include launch, effect start, fade, and end. An effect end includes tail and smoke timing and is not equivalent to the last visible impact.

## First implementation

`buildProductTimingProfile({ product, emphasis, children? })` produces resolved shot count, completeness, launch/impact/end offsets, first and last impact, total duration, and interval statistics. All offsets are relative to product ignition. Missing child timing remains unknown; it is never filled with an average interval.

`regularityScore = clamp(1 - (maxInterval - minInterval) / meanInterval, 0, 1)` describes interval uniformity only. Fewer than two intervals or fully simultaneous shots produce no regularity score.

The model is derived from existing renderer functions and resolved catalogue children. It adds no persistence fields, migration, renderer change, quantity change, QR snapshot change, or new analyser.

## Follow-up order

1. Compare profiles against preview timing for a small product sample and confirm missing-data ratios.
2. Add local cadence compatibility to fast and beat selection while keeping the same product and safety boundaries.
3. Compare fixed songs and assortments, then allow one bounded repair attempt.
4. Calibrate logged scores before deciding whether any completion gate is appropriate.
5. Keep song recommendation separate from the timing model.

The model is an estimate and has not been validated with physical fireworks or a full human listening study. The later planner, quality, repair, and recommendation phases build on it while preserving these uncertainty boundaries.
