# Music choreography integration

Show generation keeps one timing authority. `apps/web/lib/cue-generation/impact-timing.ts`
computes launch times for direct products, while replay expands persisted
multishot child offsets. `lib/fireworks/timing-profile.ts` derives renderer
estimates for matching, diagnostics and recommendations only. It does not add
another lift compensation or replace physical occupancy safety.

Timing evidence is explicit: complete, partial and unknown profiles are kept
separate. Missing child offsets do not become zero, and cadence matching is a
bounded soft preference using nearby analyser beat gaps or tempo fallback.

Both deterministic planners retain their current product eligibility, exact
assortment ledger, launch-position overlap checks, final musical hit and
section-spreading rules. LLM prompts receive structured timing metadata, but
the server still chooses every time, product, tube and quantity.

Final choreography is inspected after persisted-time safety and exact-quantity
validation. Quality separates hard validity from soft structural diagnostics and
music-sync evidence. At most one beat-planner repair candidate is inspected;
it is selected only when valid and measurably better by the provisional
comparison score.

Assortment recommendations use bounded, real Jamendo candidates and completed
analyses owned by the assortment funding user. Unanalysed candidates are
labelled internally as duration-only evidence; the consumer QR endpoint returns
only the provider tracks, not internal explanations or recommendation scores.
Browse, search, manual upload, provider licence checks and QR rate limits remain
unchanged.

The analyser reader accepts schema 1.4.0 and the compatible 1.5.0 payload with
validated `bar_grid_confidence`; unknown future versions remain fail-closed.
