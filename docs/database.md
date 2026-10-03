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

### Forward reference

`branding.logo_media_id` is a nullable UUID with a column comment identifying
`public.media(id)`. It has no foreign key while that table is absent. The media domain
must add the foreign key in both the declaration and the migration when it creates
`media`. This is the only deferred foreign key in these domains.

### Policy evidence

`tests/10_markets.sql` contains 29 assertions for public visibility, disabled markets,
and allowed and denied insert, update and delete operations. `tests/20_people.sql`
contains 222 assertions covering all people policies, two organisations, manager
store scope, invitation privacy, protected profile fields, permission mapping, Auth
synchronisation, anonymous accounts and lifecycle constraints. These are behavioural
SQL tests using the real persona roles, not source-text assertions. The existing
foundations suite contains 53 assertions. None of these database suites has been
executed by Codex in this worktree.

## Composer verification

The checked-in baseline is assembled from the ordered declarative files, not
verified CLI diff output. The composer owns local Supabase. Before committing, run
these commands with Node 24 and the pinned pnpm through Corepack:

```bash
fnm use 24
corepack pnpm db:start
corepack pnpm db:reset
corepack pnpm db:test
corepack pnpm db:lint
corepack pnpm exec supabase db diff --local --schema public,private,extensions,partman,vault > /tmp/showcrafter-markets-people-diff.sql
corepack pnpm db:types
corepack pnpm db:types --check
corepack pnpm check
```

Expected results:

- Start uses the local ShowCrafter project only. Reset applies the expanded baseline,
  default privileges, Auth profile trigger/backfill and explicit domain grants.
- Tests report 53 foundations, 29 markets and 222 people assertions, all passing
  (304 total), with `Result: PASS`. Repeat `corepack pnpm db:test` to confirm isolation.
- Lint reports no new warnings or errors.
- The schema diff reports no application schema changes. Review extension-owned
  differences against the installed local image; never discard required extensions
  or helpers just to obtain an empty diff. Keep Auth triggers and grants in their
  hand-written migrations, as the diff does not manage them reliably.
- Type generation updates `apps/web/lib/database.types.ts`; the following check
  confirms equality with the local database. Codex has not generated or edited that
  file without a running local database. Include the generated output in the commit.
- The full check passes outside the sandbox. Codex's run passed formatting, lint,
  database tooling tests, package tests, unused-file checks, typechecking and the web
  build, then failed all seven browser tests during Chromium launch: macOS denied
  Mach-port registration (`bootstrap_check_in`, permission denied 1100). No browser
  journey ran successfully and no screenshots were taken.

Static PostgreSQL parsing of declarations, migrations, PL/pgSQL functions and test
mutation queries passed. The assembled baseline also matches the declarations
byte-for-byte. Syntax and file parity do not prove live schema parity, RLS or Auth
trigger behaviour. Database reset, tests, lint, diff and type generation were not run
by Codex. CI, hosted deployment and production have not been verified.

To inspect extension availability without changing schema:

```bash
corepack pnpm exec supabase db query --local --sql "select name, default_version, installed_version from pg_available_extensions where name in ('pgcrypto', 'citext', 'pg_jsonschema', 'postgis', 'pg_cron', 'supabase_vault', 'pg_partman')"
```
