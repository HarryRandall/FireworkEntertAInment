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

- `product_versions.candidate_id`: nullable UUID, commented as a reference to
  `public.design_candidates(id)`.
- `supplier_products.last_import_id`: nullable UUID, commented as a reference to
  `public.imports(id)`.

Both referenced domains are absent, so these columns have no foreign key yet. Media's
supplier reference, poster renders' product-version reference and the branding logo
reference all have real foreign keys because those tables are present.

Review records, candidate acceptance, audit rows, storage buckets/policies and jobs are
outside these domains. Publication does not enqueue poster jobs. Posters are rendered
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
