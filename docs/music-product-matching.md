# Phase 2: Product timing and music matching

This phase adds a focused music/product compatibility layer while reusing the existing slots, section rules, product pool, exact quantities, and safety validation.

## Behaviour

- The fast planner adds a timing preference to its existing energy, colour, effect, and reuse scores.
- The beat planner orders sustained products by compatibility and ranks remaining fixed-assortment products with the same preference. Final-hit single-shot priority and exact quantities remain intact.
- The runner loads one shared set of timing profiles after product filtering. Fast, beat, fallback, and prompt paths use the same profiles.
- LLM prompts receive compact timing metadata and an explicit rule not to invent physical timing.
- Missing or unknown timing contributes zero preference. A failed data read propagates as an error.

## Data flow

`loadProductTimingProfiles` reuses `fetchShotsByCatalogueItem` to read child offsets, designs, calibres, and angles. Only multishot products require extra reads, batched at 100 catalogue IDs; single shots use their loaded specifications. Normal, accent, and peak profiles are computed once per generation.

`preserveUnknownTiming` keeps missing offsets unknown for matching. Replay calls do not enable it and retain their existing zero-second fallback. No schema, migration, public API, or permission change was added.

Fixed QR assortments still use the immutable product ledger. Timing data comes from the existing catalogue children and does not expand the assortment into substitute products.

## Compatibility calculation

Near a target time, the matcher locates the nearby beat interval with binary search and uses the median of valid local gaps. BPM is only a fallback. For resolved impact intervals it tests ratios `r ∈ {0.5, 1, 2}`:

1. `target = localBeatInterval × r`
2. `tolerance = max(0.04 seconds, target × 0.12)`
3. Score each interval with `clamp(1 - abs(interval - target) / tolerance, 0, 1)`.
4. Take the best average ratio and multiply by the Phase 1 regularity score.

Incomplete profiles, fewer than two intervals, or unknown regularity produce no cadence score. The 40 ms / 12% tolerance is an initial ranking heuristic, not a physical precision claim.

Role preferences remain bounded between -0.5 and 0.5. Single shots receive a small preference at downbeats, climaxes, and finales; cadence, sustained duration, and irregularity contribute small section-aware adjustments. These are soft preferences, not hard constraints.

## Validation and limits

Tests cover beat ratios, irregular and simultaneous firing, local tempo, missing data, both planners, exact quantities, prompt summaries, and controlled query/mapper I/O. A synthetic 120 BPM fixed pack showed the planners selecting the more compatible cake while preserving the final single shot and product counts.

The change does not phase-compensate the first visible impact of a multishot product, evaluate tempo changes across a whole song, enforce a 0–100 quality gate, or recommend songs. It has not been calibrated against physical measurements or human listening. Real database, QR generation, and preview acceptance remain deployment tests.
