# Database

The rebuild uses a declarative Supabase schema. Domain SQL lives in
`supabase/schemas/`, ordered through `schema_paths` in `supabase/config.toml`. A
single generated baseline creates the schema. Add hand-written migrations only where
generation cannot express a required trigger, grant, storage policy or schedule.

## Local workflow

Use local Supabase throughout the rebuild:

```bash
pnpm db:setup
pnpm db:test
```

Do not link, push or reset a hosted project during rebuild work. The production reset
is a deliberate, confirmed action in the switch-over runbook only.

## Schema rules

- Put queried, joined and secured facts in columns. Keep renderer-owned documents in
  JSON validated by `pg_jsonschema`.
- Use the `private` schema for security-definer helpers, set `search_path = ''`, revoke
  default privileges and grant narrowly.
- Carry `organisation_id`, `store_id` and `shopper_id` where the ownership model needs
  them, with indexes and RLS that enforce the same boundary.
- Keep multi-row state changes in transactional RPCs. Generate database types after a
  schema change.

Every policy needs a pgTAP test for one allowed case and one denied case. Test the
relevant caller roles, including staff, organisation members, suppliers, shoppers and members of another organisation.

## Foundations

The declarative files enable `pgcrypto`, `citext`, `pg_jsonschema`, `postgis`,
`pg_cron` and `supabase_vault`. `pg_partman` is enabled only when listed in
`pg_available_extensions`; an unavailable extension produces a notice and requires
native event partitioning. Its availability has not yet been checked on the owner's
local image.

`private.uid()` reads `auth.uid()`. `private.is_anon()` reads the server-issued JWT
flag, defaulting to false when absent. `private.set_updated_at()` is a row trigger
that overwrites `updated_at` with transaction time. Table-backed staff, organisation
and supplier helpers belong with their domain tables; no permissive stubs are installed.

The separate privileges migration revokes default function execution and implicit
public-table access. API roles receive private schema usage and explicitly granted identity and policy
helpers. Trigger functions and the internal role map remain inaccessible to API
callers. Privileges must be re-applied after regenerating the baseline, and new
capabilities need explicit grants.

## Test harness

`pnpm db:test` composes each SQL suite with the checksum-verified vendored Basejump
0.0.6 SQL and `tests/00_helpers.sql`, then runs `supabase test db --local`.
Every suite has its own transaction and rolls back its users, tables, helpers and
grants. The helpers file is setup, not an independent TAP suite. Domain test files
contain assertions and `finish()`, without their own transaction boundaries.
See [the vendor manifest](../supabase/vendor/basejump/README.md) for source and licence.

`tests.create_personas()` creates seven synthetic auth users: platform staff,
organisation owner, organisation manager, another organisation's member, anonymous
shopper, signed-in shopper and supplier member. These are identities, not invented
JWT roles. Domain fixtures must insert the actual staff roles and membership rows.
`tests.act_as(name)` switches to `authenticated` with the user's UUID and anonymous
flag. `tests.act_as_public()` clears identity and switches to `anon`. Use `RESET ROLE`
before switching from one persona to another or performing fixture-owner operations.
The anonymous shopper is an authenticated Supabase anonymous user, distinct from a
public request using the anon key.

## Markets and people

`10_markets.sql` declares markets, sale periods and garden safety bands. Public
requests can read enabled markets and their rules. Platform staff can review disabled
markets; only super admins and catalogue editors can change reference data. Rules
are stored as JSON objects. Sale-window evaluation and a movable-feast calendar are
not part of the enumerated market tables delivered here. Launch seed data and legal
validation are separate from schema installation.

`20_people.sql` declares profiles, staff roles, organisations, organisation markets,
stores, memberships, invitations and branding. Every mutable table has creation and
update timestamps, an update trigger and RLS. Composite keys already index ownership;
additional indexes cover stores, invitations, membership profile lookups and branding
store lookups. Branding's composite store foreign key also enforces organisation
ownership. Organisation-wide branding is unique even when `store_id` is null.

The Auth trigger creates a profile for every user, including anonymous users, mirrors
email and anonymous status on changes, and preserves the UUID and personal fields
when an account upgrades. Auth deletion cascades to the profile. Installation also
backfills existing Auth users. Clients may update only their own display name, locale,
market and last-seen timestamp. Auth owns email and anonymous status; trusted backend
operations own account status. Profiles are readable by the user, platform staff and
colleagues in the same organisation.

Platform staff rights come from `staff_roles`, never editable metadata or JWT staff
claims. Only super admins can manage those assignments. Suspended, deactivated and
anonymous profiles cannot use staff or retailer capabilities. The `requires_mfa`
column defaults to true; it stores the requirement, without enforcing a sign-in
assurance level in these policies.

The fixed retailer permission map is conservative:

| Role    | Permissions                                                                                                                      |
| ------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Owner   | `labels.print`, `qr.manage`, `range.manage`, `prices.manage`, `customers.view`, `insights.view`, `billing.manage`, `team.manage` |
| Manager | `labels.print`, `qr.manage`, `range.manage`, `prices.manage`, `customers.view`, `insights.view`                                  |
| Staff   | `labels.print`                                                                                                                   |

`private.org_ids(min_role)` recognises only `staff`, `manager` and `owner`.
`private.can(org, permission)` requires an unrestricted membership for
organisation-wide permissions. `private.can_store(org, store, permission)` checks
both organisation ownership and the member's store list. Null lists mean all stores;
empty lists mean none. Membership and invitation triggers reject null, unknown or
foreign store UUIDs in a scope. Unknown roles and permissions fail closed.

Organisation data is readable by members and platform staff. Stores and store
branding also respect assigned store scopes. Owners manage organisation settings,
extra markets, memberships and invitations; operational managers can manage their
assigned stores and branding. Invitations and their token hashes are readable only
by owners with unrestricted team rights or super admins. Invitation creation and
revocation are single-row operations here; token delivery and acceptance workflows
are not implemented. Organisations, stores and invitations have no client delete
capability; use their status or revocation fields.

The market policies need the table-backed staff helper before people tables are
created. Its PL/pgSQL body resolves those tables when called, after installation;
it is a real role lookup, not a permissive placeholder.

### Branding media reference

`branding.logo_media_id` now references `public.media(id)`. The constraint is in the
catalogue declaration and the assembled baseline because media is declared after
people.

### Policy evidence

`tests/10_markets.sql` contains 29 assertions for public visibility, disabled markets,
and allowed and denied insert, update and delete operations. `tests/20_people.sql`
contains 222 assertions covering all people policies, two organisations, manager
store scope, invitation privacy, protected profile fields, permission mapping, Auth
synchronisation, anonymous accounts and lifecycle constraints. These are behavioural
SQL tests using the real persona roles, not source-text assertions. The existing
foundations suite contains 53 assertions. None of these database suites has been
executed by Codex in this worktree.

## Fireworks and catalogue

`30_fireworks.sql` declares effects, their versions, media metadata and poster renders.
`31_catalogue.sql` declares canonical products, composition versions, letter bindings,
selection-pack contents, market legality, product media, suppliers, memberships and
supplier listings. Every table has RLS and mutable timestamps. Media ownership is
indexed by organisation and supplier. Catalogue search arrays have GIN indexes; duration,
noise and product energy have btree indexes.

Public requests and shoppers see published parents, their current published versions,
current letter bindings, public catalogue joins and ready posters. Archived parents,
drafts, superseded versions and pending posters are hidden. Media metadata, supplier
contacts, supplier members and wholesale prices are private. Active supplier members
can read their supplier's rows and insert media with their own uploader identity.
Organisation members can read their organisation's media. Platform staff can inspect
drafts; only catalogue editors and super admins can mutate catalogue data. Supplier
membership does not grant canonical catalogue editing rights.

Version and parent writes use public invoker RPCs backed by narrowly granted private
security-definer functions. No API table-write grant exists for effects, products,
versions, bindings, pack contents or confirmed legal facts. Poster uploads and the
single-row supplier/media-link operations have explicit staff policies. The service
role retains trusted backend capabilities but still obeys JSON Schema checks and
history triggers.

### Documents and lifecycle

`pnpm db:documents` embeds the canonical renderer JSON Schema and
`supabase/documents/composition.v1.json` in immutable private schema functions, then
assembles the baseline from the ordered declarations. Its `--check` mode fails on
schema or baseline drift without writing. It is included in `pnpm check`. The
baseline is assembled SQL, not captured Supabase diff output.

The effect and product draft RPCs lock their parent for numbering and pointer updates.
Autosave changes only a draft. Product autosave replaces composition and bindings in
one transaction. Publication checks tube identity, box bounds, timing by product kind,
complete bindings to published effects and staff-confirmed safety. A shared publication
advisory lock serialises product publication, effect refresh and pack operations.

Publication supersedes the old version with its payload unchanged. History triggers
reject updates and deletion outside drafts, including service-role writes. A
payload-preserving supersession is the only permitted change to a published version.
Letter bindings are protected by their containing version's lock and lifecycle.
Archive changes the parent's status, preserving history, and refuses to break a
published product or pack dependency. Foreign keys preserve referenced history rather
than cascading its deletion.

Products play current effect versions. Publishing an effect refreshes dependent
product search columns and nested published packs in the same transaction. Saved
product-version summaries remain historical. Pack contents are draft-only and cycle
checked; publication requires non-empty published contents and confirmed pack safety.
Published pack contents cannot be rewritten.

Search facts are computed in SQL during publication, rather than supplied as editable
columns. Duration follows the renderer's conservative `shotDuration` rules and saved
adjustments. Generated pgTAP examples cover all 99 templates and adjustment cases;
comparison allows one millisecond because SQL decimal and JavaScript IEEE-754 ceilings
can differ at an exact integer boundary. This is a clock-quantisation tolerance.
Colour buckets use nearest RGB palette swatches. Apex is a search bound, not a safety
certification. Fountain height uses authored speed, direction, acceleration and lifetime
with drag omitted for an upper bound. Noise is an ordinal visual/audio classification;
product safety noise remains the staff-confirmed override. Energy is an explicitly
normalised visual pacing estimate. `particles_peak` is labelled
`particles_peak_source = 'authored_estimate'`: it is a nominal authored particle budget,
not a measured peak from simulation. Actual Studio simulation/budget checks remain
separate in `effect_versions.checks`.

`confirm_product_safety` records who supplied physical safety and legal categories,
which supplier they represent, and who confirmed them with a timestamp. A supplier
source must belong to that supplier; an admin-entered source must be a catalogue editor.
Publication requires a confirmed enabled-market legal category. A failed binding,
safety or publication change rolls back every write.

### Deferred references and boundaries

- `product_versions.candidate_id` references `public.design_candidates(id)` and is
  unique when present, making candidate acceptance idempotent.
- `supplier_products.last_import_id` references `public.imports(id)`, with a composite
  supplier/import foreign key preventing cross-supplier attribution.

Both references are installed by the imports declaration after the target tables. Media's
supplier reference, poster renders' product-version reference and the branding logo
reference all have real foreign keys because those tables are present.

Review records and candidate acceptance are described below. Audit rows, storage
buckets/policies and jobs are outside these domains. Publication does not enqueue poster jobs. Posters are rendered
in the admin browser; this schema stores their metadata and staff write permissions.
Launch catalogue seeds and generated application types are not fabricated here.

### Catalogue policy evidence

The new suites contain 51 fireworks assertions, 143 catalogue assertions, 97 lifecycle
assertions and 170 renderer-duration comparisons, for 461 new assertions. With the
existing 304 assertions, local Supabase should report 765 assertions, all passing.
Fixture definitions are shared inside each isolated rollback transaction; they create
no rows unless a catalogue suite calls its setup function. Tests cover allowed and
denied policy operations, another organisation, supplier isolation, shoppers, reviewer
versus editor rights, invalid service-role documents, immutable history, supersession,
atomic failure, safety provenance, latest-effect refresh, packs and the branding FK.
None of the SQL suites has been executed by Codex for this change.

### Catalogue SQL resolution follow-up

The composer reported passing document checks, duration-fixture checks and local reset.
The first database run exposed an ambiguous `value` reference in
`adjusted_climb_time`; the composer's `adjustment` table alias is preserved. The next
run reached 592 assertions, with 29 lifecycle failures and the duration suite stopping
at ground-colour extraction. These are failed runtime results, not passing evidence.

The draft functions incorrectly qualified body-local parent IDs with their function
names. Function qualification applies to parameters in the implicit outer block;
body locals need a labelled block or distinct names. Both functions now use `v_`
parent/version IDs and an explicit version-table alias for per-parent numbering.
The lifecycle failures after draft creation are consequences of the missing drafts,
including publication, supersession, search refresh and public history visibility.
Their rule assertions remain intact.

Ground-colour extraction now names the scalar JSON-path output column explicitly;
`jsonb_path_query` does not provide an implicit `value` column. Four extra assertions
cover ground colour filtering, effect numbering across historical versions, product
replacement numbering and independent numbering for a new product.

All 24 catalogue PL/pgSQL functions explicitly use `#variable_conflict error`, so an
installer's `use_column` or `use_variable` setting cannot silently change predicates.
The audit also reviewed the five earlier domain PL/pgSQL functions, test helpers and
fixture function, and SQL helper callers. Qualified row fields, table aliases and
function-qualified parameters were distinguished from body locals. No further
unresolved collisions were identified. The declarations and assembled baseline are
in step. Static parsing cannot prove runtime relation or column resolution.

Follow-up Codex checks used `fnm exec --using 24 corepack pnpm`: `db:documents`
regenerated the baseline, both document and duration-fixture `--check` commands
passed, and `test:database-tooling` passed all 10 tests. `pglast 7.10` parsed 21 SQL
files and 66 PL/pgSQL definitions including baseline copies. `git diff --check` and
the database guide formatting check passed. `pnpm check` passed every stage through
the production build, then all seven browser tests failed at Chromium launch with
`bootstrap_check_in`, permission denied 1100. No browser journey or screenshot was
produced. The log is `/tmp/showcrafter-catalogue-shadowing-check.log`.

The composer must rerun document/fixture checks, local reset, all 765 pgTAP assertions
(twice to check isolation), database lint, schema diff, type generation and type drift
checks, then the full repository check outside the sandbox. No database command or
hosted operation was run by Codex in this follow-up.

## Composer verification

The composer owns local Supabase. Codex did not start, reset or mutate that instance.
A read-only `docker info --format '{{.ServerVersion}}'` probe returned `29.4.3`, so Docker
was reachable; database commands were left to the composer as requested.

With Node 24 and the pinned pnpm through Corepack, run:

```bash
fnm use 24
corepack pnpm db:start
corepack pnpm db:documents --check
corepack pnpm db:duration-fixtures --check
corepack pnpm db:reset
corepack pnpm db:test
corepack pnpm db:lint
corepack pnpm exec supabase db diff --local --schema public,private,extensions,partman,vault > /tmp/showcrafter-catalogue-diff.sql
corepack pnpm db:types
corepack pnpm db:types --check
corepack pnpm check
```

Expected results:

- Start uses only the local ShowCrafter project. Reset applies the expanded baseline,
  Auth trigger/backfill, revoked defaults and explicit catalogue grants.
- Document checks report canonical schemas/baseline and 170 renderer-duration examples
  in step with their sources.
- Tests report all 765 assertions passing with `Result: PASS`. Repeat `corepack pnpm
db:test` to confirm suite isolation.
- Lint reports no new warnings or errors.
- Diff reports no application DDL changes. Grant/revoke lines can appear because grants
  live in a separate migration. Review extension-owned differences against the local
  image; keep the required extensions and helpers.
- Type generation updates `apps/web/lib/database.types.ts`; `--check` confirms exact
  equality with the local schema. Include the actual generated output in the commit.
  The generated file remains excluded from ESLint and listed in Knip's `ignoreIssues`.
- The full check passes outside the sandbox, including all seven browser journeys.

### Codex evidence and remaining gates

`corepack pnpm install --frozen-lockfile` passed on Node `24.18.0` and pnpm `12.3.4`.
`corepack pnpm check` passed formatting, generated-file checks, the readability tooling
check, all 10 database tooling tests, all 367 fireworks tests, all three planner tests,
Knip, web lint, typechecking and the production build. It then failed all seven browser
tests at Chromium launch: macOS refused Mach-port registration (`bootstrap_check_in`,
permission denied 1100). No browser journey ran and no screenshots were captured.
The log is `/tmp/showcrafter-catalogue-check-final.log`.

Static PostgreSQL parsing used `pglast 7.10` from a temporary virtual environment to
check declarations, migrations, SQL/PLpgSQL function bodies, test SQL and quoted
assertion mutation statements. Schema embedding, duration-fixture generation and the
assembled baseline are checked for drift. These checks do not prove runtime SQL
resolution, RLS or transactional behaviour.

Database start/reset/tests/lint/diff, generated application types, CI, owner review,
hosted deployment and production verification have not run for this change. Service
code and contracts were unchanged, so analyser suites were not required or run.

To inspect extension availability without changing schema:

```bash
corepack pnpm exec supabase db query --local --sql "select name, default_version, installed_version from pg_available_extensions where name in ('pgcrypto', 'citext', 'pg_jsonschema', 'postgis', 'pg_cron', 'supabase_vault', 'pg_partman')"
```

## Imports, video evidence and reviews

`32_imports.sql` adds imports, import lines, video analyses, design candidates and
reviews. All five tables have RLS, mutable timestamps and update triggers. Supplier,
media, analysis, product and version lookups are indexed; import row numbers are
unique. Confidence and overall scores are normalised between zero and one. Import
lines retain raw objects, matching suggestions and explicit decision attribution.
Nothing automatically accepts a match based on its score.

All active platform staff can read the domain. Catalogue editors and super admins
can change imports, lines, analyses and unaccepted candidates. Supplier members read
only their supplier's imports and lines. They can insert an initial uploaded import
with their own submitter UUID, empty mapping/counts and no outcome fields. The upload
must reference that supplier's price-list media. The existing media insert policy
already grants own-supplier uploads with the caller as uploader. Suppliers cannot
change matching results, advance stages, read video analyses/candidates/reviews or
edit canonical catalogue data. Retailer membership, including an owner or manager,
grants no access to this domain.

Import supplier/media/submitter identity cannot change. Matched listings must belong
to the import supplier. Analyses require video media; supplier listing priors must
match its media supplier and any specified canonical product. Candidate parents must
share an analysis and cannot refer to themselves. Accepted proposals and their video
evidence cannot be rewritten, including by the service role. Reviews target exactly
one effect or product version. Reviewers, catalogue editors and super admins can
insert a decision attributed to themselves. Clients cannot update or delete reviews.
A recorded decision does not itself change a version status or publish it.

### Candidate acceptance contract

Call `accept_design_candidate(candidate_id, slug, name, kind)`. Existing products
come from `video_analyses.product_id`, retaining their metadata, current published
pointer and history; the optional metadata arguments are ignored for them. They must
be unarchived with no open draft. If the analysis has no product, non-empty slug/name
and a composed product kind are required to create one. Selection packs are rejected.

The proposal is an object with exactly `effects` and `composition`:

```json
{
  "effects": {
    "a": {
      "template": "published-template-slug",
      "overrides": { "launch": { "height_m": 70 } }
    }
  },
  "composition": {
    "tubes": [{ "i": 0, "letter": "a", "t_ms": 0, "angle_deg": 0 }]
  }
}
```

Each effect refers to an active published template by slug. Optional object overrides
merge recursively; arrays/scalars/explicit JSON null replace entire values. Overrides
cannot change effect kind. The resulting document must pass the canonical renderer
JSON Schema. The composition must pass its schema and kind-specific count, timing,
unique tube/grid-position and exact letter-coverage checks. Times are milliseconds
from first firing; angles are degrees; grid dimensions follow the composition schema.

Only catalogue editors and super admins can accept a candidate, and its analysis must
be ready. Acceptance locks the candidate, analysis and existing product, forks a draft
effect per letter with renderer/video attribution, and creates one draft product
version with `source = 'video_import'`, `candidate_id` and complete effect bindings.
Any failure rolls everything back. A candidate lock and unique candidate index prevent
duplicate acceptance; retries return the original product-version UUID. This has
static review and sequential retry assertions, but no concurrent runtime evidence.

Accepted content stays draft for inspection and QA. Acceptance neither publishes nor
confirms safety, writes reviews, charges credits, schedules jobs or generates posters.
No submission/review-state transition RPC is introduced. Supplier CSV matching, video
measurement/fitting, the worker proposal producer and QA screens are outside this
schema change. There are no new nullable references to absent tables.

### Imports verification

Use Node 24 and pinned pnpm through Corepack. Run against the configured local
ShowCrafter project only. Where `fnm` cannot run in the sandbox, select the installed
Node binary explicitly:

```bash
export PATH=/Users/harry/.local/share/fnm/node-versions/v24.18.0/installation/bin:$PATH
corepack pnpm db:documents --check
corepack pnpm db:reset
corepack pnpm db:test
corepack pnpm db:test
corepack pnpm db:lint
corepack pnpm exec supabase db diff --local --schema public,private,extensions,partman,vault > /tmp/showcrafter-imports-diff.sql
corepack pnpm db:types
corepack pnpm db:types --check
```

Local reset applied the assembled baseline, Auth profile setup and all explicit
grants, including the imports privileges migration. The baseline is assembled from
ordered declarations by `db:documents`; the local schema diff independently checks
that those declarations match the migrated database.

Both complete database test runs passed all 1,044 assertions with `Result: PASS`.
The imports suites contain 112 policy assertions, 56 integrity/acceptance assertions
and 111 failure/rollback assertions. Each suite rolls its fixtures back; the repeated
run checks isolation. Tests cover every new policy with allowed and denied operations,
supplier isolation, another organisation, immutable accepted evidence, candidate
retries, invalid documents and transactional rollback. Concurrent acceptance has not
been exercised with simultaneous connections.

Database lint identified an implicit text-to-JSONB initialiser in candidate acceptance;
it now uses an explicit JSONB cast. Three existing warnings remain in
`private.effect_facts`: a text-to-array initialiser and two immutable/stable expression
warnings. No new import-domain warnings or errors remain.

Schema diff completed with only grant lines, reflecting the separate privileges
migrations. It reported no application DDL drift. Do not apply those grant lines:
that would restore the broad default access the privileges migrations deliberately
revoke. Both carried references now have foreign keys: product versions to design
candidates, and supplier listings to imports. A composite foreign key additionally
keeps a listing's source import inside the same supplier. There are no new nullable
references to absent tables.

`db:types` generated `apps/web/lib/database.types.ts` from local Supabase and
`db:types --check` confirmed equality. The generated file remains excluded from ESLint
and listed in Knip's `ignoreIssues`. Formatting, document/baseline drift checks,
all 10 database-tooling tests, readability-rule tests, Knip, web lint and web
typechecking passed. The full `pnpm check` and browser suite were not run under the
owner's database-lane restrictions. CI and the full delivery gate remain for the
composer. No screens or service contracts changed, so screenshots and analyser tests
are not applicable. No hosted database, deployment or production verification ran.

Evidence logs from this continuation are in `/tmp/showcrafter-imports-reset-final.log`,
`/tmp/showcrafter-imports-tests-final-first.log`,
`/tmp/showcrafter-imports-tests-final-second.log`, `/tmp/showcrafter-imports-lint-final.log`
and `/tmp/showcrafter-imports-diff.log`; diff SQL is `/tmp/showcrafter-imports-diff.sql`.

## Range, stock, shows and QR routing

`40_range.sql` declares organisation range prices, store overrides, movement history,
collections and collection membership. Composite foreign keys enforce retailer
ownership of store and collection rows. Organisation-wide writes require unrestricted
range or price rights; store writes respect the membership's store scope.

Current stock has one source: the sum of `stock_movements.delta`. `store_prices` is
an invoker view that applies row policies and resolves the store override or range
price. It also exposes the latest movement source and timestamp. There is no editable
stock balance on `store_items`, and lists do not reserve stock.

`record_stock(p_store, p_range_item, p_delta, p_source, p_ref)` records signed unit
changes from `manual` or `csv`. It locks the store item, derives `qty_after` and rejects
negative resulting stock. Stock history cannot be updated or deleted, including by
service-role operations. The trusted backend can retain a `till` source; the retailer
RPC cannot claim one.

`50_shows_qr.sql` declares retailer or shopper-owned shows, immutable snapshots,
derived product quantities, campaigns, QR codes and label batches. Retailer authoring
uses `range.manage`; shopper authoring checks active ownership, including anonymous
accounts. `save_show` locks the parent, saves validated cues, numbers the snapshot,
creates its complete product-quantity index and changes the current pointer in the
same transaction. Direct API writes cannot replace the pointer or history.

The canonical cue schema is `supabase/documents/cues.v1.json`, embedded by
`db:documents`. Each cue has `t_ms` measured from show start, `product_id`, horizontal
`position` in metres, `angle_deg` from vertical and an optional non-negative beat
index. Duration and soundtrack offset are milliseconds. Duration is the authored
playback window, including optional silence; every launch must fall within it.
`show_store_status` computes current totals and quantity-aware availability.
Stock and range triggers maintain `live` or `stock_issue` status when a product is
unavailable at every open store, and recover after replenishment.

QR targets are validated by type, catalogue publication and organisation ownership.
Codes cannot be deleted and their slugs cannot change or be reused. Label batches
validate all code UUIDs, store print scopes and retailer-owned PDF media. Browser
printing does not require PDF jobs.

### Public RPCs

Public API roles have no raw access to retailer tables or pricing views. Public
invoker wrappers call narrowly granted private security-definer readers, with empty
search paths and explicitly selected output fields:

- `resolve_qr(p_slug)` returns a visible target for an open store. Paused, archived
  or unavailable targets fall back to the store page. Organisation-wide codes return
  `pick_store` and open stores, each with its applicable target or fallback.
- `store_page(p_store)` returns store contact details, safe organisation identity,
  visible published range, live collections and retailer show names. Catalogue
  entries must have confirmed market listings and the market's currency. Manual
  collection membership and smart price/noise/tag/colour filters use the current
  visible store range.
- `show_for_store(p_show, p_store)` returns a matching live retailer show or the active
  caller's own saved show whose products are visible at that store. Its playback resolves current published product
  compositions and current published effect designs, including selection packs.
  Price and availability reflect current store facts. Shopper-owned shows require active ownership.

Unavailable stores, suspended/closed retailers, unknown slugs and inaccessible shows
return SQL null. Supplier contacts, wholesale prices, review records, history and
private store licence/onboarding fields are excluded from public responses.

### Show soundtrack and planning references

These nullable UUID columns have foreign keys declared with their target domains:

- `shows.soundtrack_track_id`: `public.music_tracks(id)`.
- `show_versions.soundtrack_analysis_id`: `public.music_analyses(id)`.
- `show_versions.plan_session_id`: `public.plan_sessions(id)`.

The shopper and music declarations install these constraints after their target tables
exist. Snapshot validation also checks that a pinned analysis belongs to the show's
soundtrack and that a linked planning session belongs to its shopper owner.

### Local verification and remaining checks

Verification used Node 24.18.0 and Corepack pnpm 12.3.4 in this checkout:

- `corepack pnpm db:reset`: passed, including the domain baseline and explicit grants.
- `corepack pnpm db:test`: passed twice consecutively, 15 suites and 1,327 assertions
  on each run. Coverage includes every new policy's allowed and denied cases, another
  organisation, store scopes, stock arithmetic, immutable snapshots, latest designs,
  nested selection packs, smart collections and QR fallback.
- `corepack pnpm db:lint`: exited successfully with no new function issues. The three
  existing `private.effect_facts` warnings remain (one assignment cast and two volatility warnings).
- `corepack pnpm exec supabase db diff --local --schema public,private`: passed, with
  440 grant statements and no other statements. Grants remain in their separate
  hand-written migration; do not apply that diff as a grant repair.
- `corepack pnpm db:types`, then `corepack pnpm db:types --check`: passed and matched
  the local schema.
- `corepack pnpm format:check`, `corepack pnpm db:documents --check`,
  `corepack pnpm test:database-tooling` (10 tests), `corepack pnpm lint`,
  `corepack pnpm typecheck` and `corepack pnpm knip`: passed. Knip retains one existing
  `.css` configuration hint.

A denied direct call to `private.product_playback(uuid)` as `anon` reproducibly
terminated the local PostgreSQL 17.6 process with signal 11, both inside pgTAP and
from psql, including with a PL/pgSQL implementation. Those interrupted test runs are
failed evidence. The added internal-capability assertion instead checks the live
`has_function_privilege` result, which is false for `anon`. Its SQL comment records
this local-image limitation. All new policy denials, public table/view denials and
retailer RPC denials still execute as their real personas. The composer should
investigate the local image's denied-function crash separately; no database image,
privilege boundary or assertion threshold was changed to work around it.

Logs are in `/tmp/showcrafter-range-reset.log`, `/tmp/showcrafter-range-tests.log`,
`/tmp/showcrafter-range-tests-repeat.log`, `/tmp/showcrafter-range-lint.log`,
`/tmp/showcrafter-range-diff.sql` and `/tmp/showcrafter-range-diff.log`. The reproducible
crash evidence is `/tmp/showcrafter-range-denied-function-crash.log`. The declaration
and generated baseline were refreshed through the existing `db:documents` workflow.
The schema diff verifies their application DDL is in step.

`pnpm check` and `pnpm test:browser` were intentionally not run in this lane. There
are no screen changes or screenshots. Full repository/browser checks and CI remain
composer gates. No hosted database, deployment or production behaviour was verified.

## Shopper planning, lists and consent

`60_shoppers.sql` declares `plan_sessions`, `plan_candidates`, `plan_edits`, `lists`,
`list_items`, `follows` and `privacy_requests`. Ownership is through active profiles,
including Supabase anonymous accounts. Ownership and store identity cannot be reassigned.
Parent keys index candidate/edit access; shopper, store and organisation lookups have
explicit indexes. Mutable rows use the shared timestamp trigger.

Shoppers read only their own plans, candidates, edits, lists, items and privacy
requests. Retailer members may read redeemed lists and their items only at stores
within their membership scope. Staff and supplier capabilities do not bypass
shopper privacy. Trusted backend operations author solver snapshots, edit outcomes,
redemption and privacy-request results; API clients have no direct table-write grants
for those facts. The schema retains the `llm` edit source without adding an LLM writer.

Public invoker wrappers delegate to narrowly granted private security-definer functions:

- `start_plan_session` checks active ownership, an open store, a matching live QR code
  when supplied and an explicit, non-future age confirmation timestamp. It stores the
  initial answers, solver and stock/input hash and returns a new session UUID. Answers
  currently require a JSON object; detailed solver-answer validation is not installed.
  The transaction contains a labelled credit-settlement hook, with no charge or
  reservation written because the ledger is absent. Session rate limiting is absent.
- `create_list` accepts product UUIDs and positive integer quantities, a unique
  sixteen-digit till code and the caller-supplied sale-period end date. It checks current
  store availability and quantity, snapshots current prices and currency, and optionally
  marks an owned candidate picked and its session listed in the same transaction.
  Failure on any item rolls back the parent and all items. Lists do not reserve stock.
  Sale-calendar calculation is not installed; the RPC rejects expired dates but does
  not independently derive the current sale-period end. Till-code generation is not
  installed. The backend owns redemption and expiry transitions.
- `shop_customers` returns identity and list summaries only for active shoppers with
  `follows.visible_to_shop`, requiring organisation-wide `customers.view`. Restricted
  store memberships cannot obtain the organisation-wide result. It does not extend
  general profile visibility. Hidden follows never expose identities through this
  reader, and withdrawing consent removes the customer immediately. Event joins are
  absent because events are not declared.

Shoppers can insert, update and delete their own follows. Marketing consent is
separate from shop visibility and defaults to false. Database transaction time stamps
changes to consent choices and wording versions. Clients cannot transfer or backdate
consent rows. Shoppers can request their own export or deletion, with only the backend
able to set a result or terminal status. Request processing is not installed.

### Nullable external references

- `plan_sessions.credits_reservation_id`: nullable UUID for
  `public.credit_reservations(id)`, documented in the declaration without a foreign key.
- `plan_edits.llm_call_id`: nullable bigint for `public.llm_calls(id)`, matching the
  schema plan's bigint identity, documented without a foreign key.

## Shared music

`70_music.sql` declares `music_tracks` and `music_analyses`. The provider and track ID
form the shared catalogue identity; Jamendo requires a provider track ID. Track
identity cannot be rewritten. Commercial use is constrained to false for every
caller while licensing is unconfirmed. Only catalogue editors and super admins can
insert or update track metadata. Shoppers cannot upload tracks.

Public readers see published tracks and their current analyses. Historical analyses
remain readable when pinned by a caller-accessible show or a live retailer show.
Withdrawn tracks hide their analyses from public readers. Platform staff can inspect
unpublished tracks and analyses. Storage access and signed audio URLs are separate.

`save_music_analysis` is backend-only. It locks the track, reuses an existing result
for the same algorithm and SHA-256 audio fingerprint and selects exactly one current
analysis atomically. Invalid reanalysis rolls the pointer change back. Analysis payloads
and fingerprints cannot be rewritten, including by the service role. Existing show
snapshots keep their pinned analysis when a new current result is installed, and
foreign keys prevent deletion of referenced analyses. No analyser job, download,
Jamendo API call or worker has been introduced.

### Shopper and music verification

Local verification uses Node 24.18.0 and Corepack pnpm 12.3.4:

- `corepack pnpm db:reset`: passed with the assembled baseline and explicit grants.
- `corepack pnpm db:test`: passed twice consecutively, 18 suites and 1,589 assertions
  per run. The three added suites cover allowed and denied policies with the real
  personas, another organisation, anonymous ownership, consent withdrawal, store
  restrictions, transaction rollback, snapshot prices, shared-track identity and
  pinned analysis history.
- `corepack pnpm db:lint`: passed with no new issues; the three existing
  `private.effect_facts` warnings remain.
- `corepack pnpm exec supabase db diff --local --schema public,private`: grant-only
  differences; no application DDL drift. The grant differences come from the separate
  hand-written privileges migrations and must not be applied as a grant repair.
- `corepack pnpm db:types`, then `corepack pnpm db:types --check`: passed.
- `corepack pnpm format:check`, `corepack pnpm db:documents --check`,
  `corepack pnpm test:database-tooling` (10 tests), `corepack pnpm lint`,
  `corepack pnpm typecheck`, `corepack pnpm knip` and `git diff --check`: passed.
  Knip retains the existing `.css` configuration hint.

The first expanded test run failed because a test nested a data-modifying CTE instead
of placing it at the top level. Corrected assertions passed without changing policies.
Database logs are `/tmp/showcrafter-shoppers-reset.log`,
`/tmp/showcrafter-shoppers-tests.log`, `/tmp/showcrafter-shoppers-tests-repeat.log`,
`/tmp/showcrafter-shoppers-lint.log`, `/tmp/showcrafter-shoppers-diff.sql`,
`/tmp/showcrafter-shoppers-diff.log` and `/tmp/showcrafter-shoppers-types.log`.

`pnpm check` and `pnpm test:browser` were intentionally not run in the database lane.
No screen changes or screenshots are involved. Full repository/browser checks, CI,
owner review and production verification remain separate gates. No hosted database
was accessed. Credit charging, rate limiting, event joins, privacy processing, sale
calendar derivation and worker execution have not been verified.
