# Phase 4: Assortment-aware song recommendations

## Delivered

The QR song picker now offers “Recommend music for me” while keeping search, genre browsing, previews, and “Use my own song”. Recommendations show the track, artist, and a short explanation without exposing the internal score. Selecting a track only changes page state; Generate still starts the existing import, analysis, and show workflow.

## Architecture and cost

`GET /api/assortments/[token]/music/jamendo?mode=recommend` keeps the public-token, active-assortment, server-resolved funding-user, durable-rate-limit, and private/no-store boundaries.

1. Use the existing Jamendo browse API for general, ambient, and electronic pages. Candidate collection is bounded at 60 unique provider tracks.
2. Read only products in the assortment, capped at 100 catalogue IDs, and derive quantity-weighted timing features. Missing products or database errors fail closed.
3. Reuse completed, owner-scoped Jamendo analyses for candidate IDs, validating the stored schema and limiting the query to 300 rows.
4. Rank deterministically and return at most five provider tracks. Analysis JSON, user IDs, private audio paths, and internal scores are never returned.

Browsing creates no analysis, download, Storage write, LLM call, credit reservation, or show. Existing Jamendo cache entries and completed analyses are reused.

Unanalysed candidates receive a duration-only suggestion and the UI states that rhythm has not been analysed. Selecting a track and pressing Generate follows the existing analysis and reuse lifecycle.

## Ranking

The assortment profile includes total pieces, known timing pieces, single shots, regular rhythmic products, sustained products, dense sequences, and weighted timing capacity. A dense sequence means at least four shots with at least two impacts per second; this is a timing proxy, not a claim about visual power.

Each fit is bounded to 0–1 and the final score is `round(100 × Σ(fit × weight) / Σweight)`. Unknown dimensions are omitted from the weighted evidence; ties use track ID order.

| Dimension     | Weight and rule                                                                           |
| ------------- | ----------------------------------------------------------------------------------------- |
| Duration      | 60; fill the estimated capacity where possible and penalise overlong tracks exponentially |
| Cadence       | Up to 20, based on real intervals, local beat timing, and beat stability                  |
| Dynamics      | 10, comparing energy contrast with the assortment profile                                 |
| Gentle pacing | Up to 10 for sparse assortments, favouring slower tempo                                   |
| Ending        | Up to 10 for dense assortments, using the analyser finale window or the tail energy       |

Reasons are shown only when their evidence supports them. The score is a bounded heuristic, not a probability or a visual-quality guarantee. Existing product quantity, safety, and Phase 3 validation still govern generation.

## Validation and limits

Tests cover short packs, stable rhythm, strong endings, sparse pacing, unknown timing, missing analysis, provider membership, deduplication, bounds, analysis reuse, owner scope, and database failures. A mobile Chrome smoke test covered recommendation reasons, browsing, selection, and manual upload with a mocked API and no writes.

The candidate pool is bounded and is not a full-catalogue optimum. New funding users commonly receive duration-only suggestions. No background pre-analysis or shared analysis library is created. Capacity is a sequential timing estimate; climax and ending use density proxies rather than a complete visual-effect taxonomy. Full production and human listening acceptance remain separate steps.

Manual acceptance: open `/a/<token>`, choose Recommend music for me, preview and select a track, press Generate show, and verify progress, output, and exact assortment quantities. Repeat with search, manual upload, invalid or revoked tokens, recommendation failure, and an unavailable provider track.
