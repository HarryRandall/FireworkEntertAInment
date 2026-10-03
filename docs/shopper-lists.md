# Shopper lists and account

Product additions reuse the shopper's open product list at that store and sale-window
end. Adding the same product increases its quantity and retains the first unit-price
snapshot. Saving a plan creates a separate list and an owned show with immutable cues
and the candidate's soundtrack analysis pin. Both operations use private transactional
functions, thin public wrappers and private replay keys. Lists never reserve stock or
charge planning credits.

Fixed sale windows use their inclusive closing date in the store's timezone. Supported
cross-year windows close in the following year when appropriate. An all-year licence
outside a fixed window uses 31 December of the store's current year. Unsupported feast
calendars remain closed without an all-year licence. Reads and quantity writes enforce
expiry before maintenance runs; maintenance uses the same store calendar.

The till pass shows the actual sixteen-digit identifier as Code 128 C and a grouped
number. JsBarcode 3.12.3 is an MIT-licensed dependency, using its bundled declarations;
no registry component provides barcode encoding. The existing kit supplies the rest of
the controls and theme tokens. Empty, redeemed and expired lists hide barcode artwork.
Payment and ID checks take place at the shop.

Email save reuses the existing anonymous-account `updateUser` flow and returns to the
owned account list. Activity sharing and marketing are separate, optional choices,
defaulting to false. Consent is stored per retailer organisation, shared across that
retailer's stores, with text version `shopper-consent-1`. Choices remain editable in
Followed shops and Settings.

The existing account shell hosts overview, saved shows and playback, lists and list
details, planning history, followed shops and settings. Overview counts use real owned
records, without invented activity or shopper credit allowances. Settings edits the
personal name and submits export or deletion requests. Request acknowledgement means
pending processing, not completed export or deletion. No notification delivery,
privacy fulfilment, online payment, stock reservation or analytics instrumentation is
implemented by these pages.

## Local verification

Node 24.18.0 and the pinned pnpm 12.3.4 were used.

- Frozen install, formatting, generated seeds/validators/documents/duration fixtures,
  lint tooling tests, database tooling tests, all package checks and Knip passed.
- `pnpm --filter @showcrafter/web check` passed: lint, typecheck, 83 tests and production
  build. `pnpm exec tsc -p tests/browser/tsconfig.json` passed.
- `pnpm db:setup` passed. `pnpm db:test` passed: 42 suites, 2,695 assertions, concurrent
  job claims, 99 public templates, six local persona sign-ins and seeded planner checks.
- Focused lists and maintenance passed: two suites, 55 assertions, including soundtrack
  pins, expiry before maintenance and suspended-account denial.
- `pnpm db:lint` completed with the existing `private.effect_facts` text-to-text-array
  warning. Database types and documents freshness checks passed.
- `supabase db diff --local --schema public,private` contained 871 privilege statements
  and no other statements. These represent separate hand-written privilege migrations;
  do not apply the diff as a migration.
- Worker tests passed (19); video tests passed (21). The analyser and analyser contract
  checks failed with 11 errors each in Numba caching. The pre-existing analyser virtual
  environment resolves into the excluded database lane. No follow-up inspection or environment changes were made there.
- Earlier database attempts lost a connection in an existing range suite and encountered
  an incomplete Auth schema. Fresh setup and the final full run passed without changing
  unrelated test code.

The intact root `pnpm check` was not run because it invokes browser execution, prohibited
for this sandbox. Its non-browser steps were attempted individually, with the analyser
failures above. No dev server or browser was started. No screenshots, live accessibility
results, owner visual approval, CI or production verification are claimed.

Composer browser checks are in `tests/browser/lists.spec.ts`. They exercise product and
plan additions, quantity and price persistence, till artwork, Mailpit email upgrade with
the same UUID, independent retailer consent, account routes and privacy requests. The
390 px and desktop, light and dark matrix asserts no page overflow and no axe violations,
and captures full pages and each `data-section` into the Playwright result directory.
Screenshots still need to be produced and compared with `planner.html` and `shopper.html`.
Evidence logs use `/tmp/lists-*`; the passing database run is
`/tmp/lists-db-test-delivery.log`, with schema diff in `/tmp/lists-db-diff-delivery.sql` and final web
checks in `/tmp/lists-web-check-delivery.log`.
