# Shopper plan changes

The store planner's Change it panel uses kit buttons, a labelled swap selector and
`ChatPrompt`. It supports six chips and a small list of exact phrases. There is no
model call. Names combine a mood template, the headline product and the occasion.

## Behaviour and product choices

- Longer adds one minute to the requested length, capped at ten minutes. Success
  requires a longer visible show, rather than just a changed answer.
- Cheaper targets 80% of the current total and cannot raise the existing budget.
- More crackle retains the shopper's existing looks, adds a crackle preference and
  requires more crackling purchased units in the resulting show.
- Bigger finale requests the solver's big-finale pacing mood and requires a
  headline product with higher catalogue energy.
- Quieter steps loud to normal, or normal to quiet, and requires a lower maximum
  noise level. The phrase 'pet friendly' always requests quiet.
- Swap replaces all units of the selected product. A result must contain a
  replacement unit, rather than simply removing that product. Successfully swapped
  products remain excluded from subsequent edits and alternatives in the session.

Supported typed phrases include 'make it longer', 'make it cheaper', 'more crackle',
'bigger finale', 'make it quieter', 'pet friendly' and 'under 100'. A budget can carry
an appropriate currency symbol or ISO code and up to two decimal places. Budgets
use the store's currency and can only tighten the existing limit. Compound,
negative, mismatched-currency and unknown requests ask for one supported change.
Messages are limited to 300 characters.

The edit boundary refreshes public stock, prices, eligibility and published timing,
then re-solves through the deterministic planner. It considers the bounded diverse
candidate prefix and selects the qualifying result with the fewest purchased-unit
changes. Failure is an honest search outcome, not proof that no possible show
exists. It preserves the previous candidate and records an infeasible reply.

## Persistence and concurrency

`persist_plan_edit` is service-only, backed by a private security-definer function.
The server authenticates the shopper and reads the session through RLS before
calling it. The RPC serialises with alternatives, checks active ownership, the
highest candidate rank, revision, history sequence and input hash, and commits
history, candidate revision and the current solver snapshot atomically. Request
UUID retries return the existing edit without another revision or rate token.
The client retains that UUID when retrying an unchanged request after a failure.

The edit rate limit allows six requests in a burst and earns one token per minute.
Edits, including clarification and infeasible attempts, spend no additional credits.
Every history record stores chip/rule source, structured ops and its outcome. Applied
diffs retain added/removed quantities and product names, unit prices, currency and
exact totals before and after. Reloads read the edited candidate and history from
the owned database session.

## Local acceptance and remaining gates

The browser journeys cover every chip, typed rules, infeasibility, clarification,
stale tabs, no additional credit charge, quantity diffs and edited-plan reloads.
They also check 390 px and desktop layouts, light and dark themes, horizontal
overflow, axe violations and per-section screenshots. They wait for real state,
retry clicks which could race hydration and use no fixed sleeps.

Browser execution and screenshot capture are delegated to the composer because
Chromium cannot launch in the implementation sandbox and port 3000 is shared.
The owner must review the actual screens alongside `prototype/planner.html`.
No hosted database, deployment or production verification is implied by local
unit, SQL, type or build checks.
