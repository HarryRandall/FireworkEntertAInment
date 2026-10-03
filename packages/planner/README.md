# Planner

A synchronous, deterministic Node solver over a validated store snapshot. It does
not query a database, reserve stock, charge credits or call a model. Import the
public API from `src/index.ts`.

```ts
const result = solvePlan(snapshot);
// Show the first candidate. Request a larger stable prefix when another is wanted.
const alternatives = solvePlan(snapshot, { candidate_count: 2 });
```

`solvePlan` accepts unknown input, validates it and returns `invalid_input`,
`infeasible` or `ok`. Validation failures include paths and messages. Unexpected
implementation errors are thrown. The caller must handle all three result states.
The default is one candidate; up to ten can be requested. A larger request keeps
previous ranks unchanged. `exhausted` means the bounded search has no further
material alternatives, rather than proving that every possible combination was
examined.

## Caller contract

The package owns its types and Zod validators. Field names follow the database
shapes in `products`, `product_markets`, `store_prices`, `markets`, `safety_bands`,
`plan_sessions` and `plan_candidates`; there are no imports from the web app.

- Answers use `budget_minor`, ISO currency, garden band, noise choice, look names,
  `length_min` and a soundtrack track UUID or null. Occasion participates in the
  input identity but does not impose an undocumented purchasing constraint.
- Pass one unique product snapshot per product ID, for this store, with its
  resolved override/default unit price and current physical stock quantity.
  Hidden, unpublished, foreign-store, out-of-stock, wrong-currency, unconfirmed,
  unsafe or market-ineligible products are excluded. Null safety facts fail closed.
- `safety_confirmed` and market `confirmed` represent the supplier/admin provenance
  fields, rather than an inference from rendered effects. Garden distance and legal
  categories come from the market's selected safety band, not hard-coded distances.
- `sale.open` must be the trusted `sale_open` result for this store at
  `sale.evaluated_at`, including regional periods, movable feasts and licence
  exceptions. The solver does not recreate calendar or legal rules. Re-evaluate
  sale eligibility before reusing cached plans or making a list.
- `age_confirmation.minimum_age` is the threshold the shopper actually confirmed,
  not a guessed date of birth. A market or product requiring a stricter threshold
  is excluded until that threshold is confirmed. A missing confirmation refuses
  the request.
- Each cue represents one purchased unit, including a complete cake, not one
  internal tube. `duration_ms` is the complete published composition's last visible
  end after ignition. `impact_delay_ms` is its first headline impact after ignition:
  the published tube offset plus resolved launch climb plus the chosen break
  offset, or zero for an immediate ground effect. Resolve quick adjustments before
  deriving this delay. Do not infer it from apex height. The caller supplies these
  explicit timing facts; the solver rebuilds impact-to-ignition timing with
  `scheduleImpactWithLift` and the shared ignition-spacing constant.
- The source catalogue allows nullable timing/energy and version IDs. The solver
  requires usable published timing, energy and a version UUID; an adapter must
  resolve these before calling it. Packs require a resolved complete-unit snapshot
  and version identity from their contents. It never invents absent facts.
- Music is the existing validated `MusicAnalysis` producer contract, in seconds
  from audio origin. Cues and output durations use integer milliseconds from that
  same origin. Track UUID and exact analysis data participate in the cache key.
  Save the corresponding analysis UUID with the candidate in the caller.

## Selection and timing

All expansions enforce integer minor-unit budget and quantity limits. Equality at
budget is allowed; free products are supported. Lists never reserve stock. Recheck
price, stock and safety on the eventual purchase path.

A bounded beam search explores three energy trajectories, retaining twelve
assortments at each depth, up to 24 whole units. Each mood considers 24 products
ranked by look/energy fit, plus four cheapest and four longest-duration products.
Those fallbacks preserve affordable choices when premium products dominate the
range. Four assortments per depth survive for ranking. These work limits are named
constants, not wall-clock cut-offs. This is a heuristic, with no global-optimality
claim. Requested length is a soft preference: the solver neither fabricates stock
nor inserts minutes of silence to reach it. One indivisible unit can exceed the
requested length. Complete music plans must finish within the supplied audio.

Score terms are in [0, 1]:

| Term       | Default weight | Meaning and initial rationale                                                                                         |
| ---------- | -------------- | --------------------------------------------------------------------------------------------------------------------- |
| Variety    | 0.25           | Coverage of up to four distinct products; enough variety for a small garden show without penalising sensible repeats. |
| Pacing     | 0.35           | Equal shares of duration fit and energy-curve fit. Leads the objective to favour a coherent opening and finale.       |
| Budget use | 0.20           | Total divided by budget, with zero-budget free shows scoring one. Rewards value without forcing expenditure.          |
| Look match | 0.20           | Mean fraction of requested looks matched per unit. Equal priority to value.                                           |

Weights are composer-authorised initial judgements for owner review. Callers may
supply non-negative weights with a positive finite sum. They are normalised at
scoring and included in the input hash. Look matching is case-insensitive: catalogue
colours/tags, crackle flags, three-colour coverage, and shape/comet/rocket aliases.

Without music, products rise in energy with default trajectory endpoints of
0.15 to 0.55 (gentle), 0.30 to 0.85 (balanced), or 0.35 to 1 (big finale). Ignition
advance is 90%, 80% or 70% of the previous display duration respectively, with at
least the shared half-second spacing at the single central launch position. All
angles are vertical. These overlap factors are visual pacing judgements, not
physical safety instructions or a firing-system design.

With music, whole units are ordered against the sampled energy trajectory, so a
quieter ending can follow a louder opening. The audio energy timeline is interpolated; section averages fill a
missing energy timeline. Headline impacts snap within two seconds of the ideal
target. Downbeats and section starts receive half a second of preference over an
ordinary beat. Ignition is computed by subtracting the product delay, so a burst
lands on the audio event. Beats too early for a non-negative, adequately separated
ignition are skipped. Sparse grids use the deterministic default clock. The cue's
`beat` is the producer's zero-based beat index or null for a section/fallback.
Visible duration is the maximum ignition plus full product duration, never just
the last cue time. Clocks respect PostgreSQL's integer storage ceiling.

Candidates rank by the normalised weighted score, with lexical tie-breaks. Another
candidate must have a different headline product or at most 75% shared unit
quantities with every already ranked plan. Merely changing timing or relabelling
the same assortment does not qualify.

## Cache identity

`input_hash` is SHA-256 over answers, a canonical full stock/product snapshot hash,
market/safety/sale/age eligibility, exact music data, weights and solver version.
Product order, object property order, look order and catalogue tag/colour order do
not affect the identity. Sale-evaluation and age-confirmation timestamps are
excluded; their resolved eligibility and confirmed threshold are included.
Cache lookup must follow fresh eligibility checks. Changes in price, quantities,
versions, timing, safety, preferences, music or weights invalidate the input hash.
The candidate count is deliberately excluded so a larger prefix reuses the same
session identity. Keep the solver version beside persisted sessions.

## Local evidence

Run with Node 24 and the pinned Corepack pnpm:

```sh
corepack pnpm --filter @showcrafter/planner check
corepack pnpm test:packages
corepack pnpm exec prettier --check packages/planner
corepack pnpm knip
```

The package check includes schema drift, lint, typecheck and node:test suites.
Tests cover request/product refusals, exact budgets, quantity accounting, immutability,
order-independent determinism, cache invalidation, material alternatives, audio
clock alignment, 150 seeded generated ranges and five timed complete solves of a
300-product range under two seconds. Property invariants are checked independently
of the eligibility implementation.

The fixed Hartley goldens project the four products, prices, opening stock and
illustrative safety facts from `supabase/seed/30_demo.sql`. IDs are fixed synthetic
fixtures because seed product/version IDs are generated. Durations and impact
delays come from the resolved built-in designs. Colours, tags and energy are
illustrative projection facts, not queried database summaries. These tests prove
solver behaviour against a fixed demo input, not live database adapter correctness.
Golden cases cover a garden show, a quiet silver preference and a tight budget.

No app adapter, UI, persistence, credit charging, edits or naming is implemented
here. No browser, hosted database, deployment or physical-firework verification is
claimed. The music producer contract is unchanged.
