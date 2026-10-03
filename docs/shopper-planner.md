# Shopper planner

The public `/shopper/stores/[slug]/plan` route uses the shopper pages, outside the
workspace shell. The store's market supplies the age gate, currency and safety
bands. Five questions collect occasion, garden, budget, noise, and looks plus
length. The selected product is inspiration and remains visible before questions;
it is not guaranteed to fit the resulting plan.

The budget control runs from 40 to 400 major currency units, in increments of 10.
Length runs from two to ten minutes and is a target, not a minimum: safe stock and
the budget take precedence. Defaults follow the planner prototype. Explicit Next
buttons keep keyboard and touch navigation consistent.

## Trust and persistence

`planner_context` returns public product facts and market bands. Published
compositions determine impact clocks, including saved renderer adjustments.
Published selection packs are immutable catalogue rows without composition-version
UUIDs; their contained products supply playback. Prices use integer minor units.

Planning actions verify the Auth user on every request, read owned history through
RLS and run `@showcrafter/planner` on the server. Only then can the server's
service-role client call `persist_planner_result`. Browser roles cannot write
solver results or set prices. Missing server credentials and unexpected database
failures remain errors. The server needs `SUPABASE_SERVICE_ROLE_KEY` alongside the
normal local Supabase configuration; it never goes into a client bundle.

The database RPC serialises a request UUID, inserts its session and candidate,
and settles one retailer credit in a single transaction. Retrying that UUID reuses
the stored result. Failed credit settlement or candidate validation rolls back the
whole write. A start bucket permits three requests initially, refilling one token
per 20 minutes. Alternatives permit six requests initially, refilling once per
minute. Limits are per shopper across stores. The existing session-creation RPC
shares the same start bucket.

Validated local storage retains question progress, age confirmation and the request
UUID. Completed session links resume through RLS. Alternatives use the original
solver snapshot and append the next diverse rank. Earlier candidates stay in
history and the UI displays the highest requested rank. Saved prices are snapshots;
stock is not reserved. Preview failure leaves the products and total usable.

An all-year shop licence opens planning. Seasonal shops require a matching fixed
annual sale window, evaluated in the store's time zone, including windows across
New Year. Unsupported feast calendars fail closed. These are seeded testing rules,
not verified legal guidance.

## Local checks and visual review

`pnpm db:reset && pnpm db:test` runs the SQL ownership, credit, replay and rate-limit
checks, plus read-only acceptance against the actual Leeds and York public
snapshots. `pnpm --filter @showcrafter/web test` covers the adapter, validation and
question-progress contracts. `pnpm exec tsc -p tests/browser/tsconfig.json` checks
the browser journeys without launching Chromium.

The composer runs `pnpm test:browser` against the local app. `planner.spec.ts`
covers the age gate, all five questions, reloads, alternatives, missing credits
and rate limits. It captures each screen's sections at 390 px and desktop, in light
and dark, checks axe and page overflow, and waits for real state changes. Capture
paths begin `output/playwright/planner-`. Owner visual review is required.

Change it, Pick music and Save to list are explicitly unavailable controls. Planner
activity uses the named shopper event boundary; it dispatches local events without
sending or persisting activity.
