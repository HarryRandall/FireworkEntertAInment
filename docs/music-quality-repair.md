# Phase 3: Quality comparison and limited repair

This phase uses music-sync metrics for candidate comparison and logging. It does not impose an 85-point hard completion gate.

## Decision flow

1. Keep the original cue list and the planner that produced it. If an earlier LLM fallback already used the beat planner, do not repeat the same repair.
2. Validate product IDs, slots, launch times, stored-time rounding, safety, exact assortment quantities, and prompt constraints for every candidate.
3. A non-beat candidate with hard issues, structural gaps, weak strong-time coverage, or weak timing evidence gets one beat-planner repair attempt. An unused-position warning alone does not trigger repair.
4. Compare valid candidates by integer comparison score; ties prefer fewer issues, then the original candidate. A higher score cannot bypass a hard failure.
5. If repair fails, keep the valid original. If neither candidate is valid, generation fails before completion is stored.

Fixed QR assortments do not exempt soft timing issues from the repair attempt. Residual soft warnings may remain on a valid result; this version does not promise a subjective quality threshold.

## Timing evidence

`evaluateMusicSync` uses complete profiles and actual launch timestamps. Single shots compare `launch + firstImpactOffset` with the assigned slot. Multishots compare sequence start, preserving the existing timing contract. Regular multishots additionally use cadence compatibility when regularity is at least 0.65. Unknown evidence is excluded rather than treated as perfect.

Anchor accuracy is `clamp(1 - abs(actualAnchor - slotTime) / 0.12, 0, 1)`. Timing score combines anchor accuracy at 70% and cadence at 30%, renormalising when one component is unavailable. Accuracy below 0.8 or cadence below 0.5 requests one repair; it does not directly reject generation.

## Comparison score

`comparisonScore = round(30 × sectionCoverage + 25 × coordinatedStrongCoverage + 15 × gapQuality + 30 × timingScore / 100 × evidenceCoverage)`.

Effect intervals include renderer tails and smoke. They provide coverage evidence but are not a measure of visual intensity. Unknown products contribute only their known anchor points.

## Validation

The synthetic 120 BPM fixed-pack case selected the beat repair candidate with comparison scores 68 versus 78 while keeping timing score 85, exact product counts, and the 52-second final single shot. Remaining structural warnings were retained and logged.

Structured logs record planners, scores, timing components, issue kinds, failure codes, repair attempts, adoption, and residual issues. They do not record raw audio, prompt text, product names, or capability tokens. No migration or permanent UI score was added.

Tests cover candidate comparison, tie-breaking, planner errors, QR ledgers, final hits, timing evidence, and real planner integration. Full generation tests, type checking, source lint, and build pass when the generated `platform/.next` tree is excluded from the repository lint scan. The raw repository lint command still sees pre-existing generated-file errors.
