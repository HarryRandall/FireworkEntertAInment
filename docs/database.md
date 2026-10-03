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
public-table access. API roles receive private schema usage and only the two identity
helpers. Triggers are attached by the table owner. Privileges must be re-applied after
regenerating the baseline, and new capabilities need explicit grants.

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

## Composer verification

The checked-in foundations baseline is assembled from the declarative files, not
verified CLI diff output. The composer must generate and review it on local Supabase
before committing, keeping default privileges in their separate migration:

```bash
pnpm db:start
pnpm exec supabase db diff --local --schema public,private,extensions,partman,vault > /tmp/showcrafter-foundations-diff.sql
pnpm db:reset
pnpm db:test
pnpm db:lint
```

Review any diff against the installed schema. A fresh shadow database may report
extension-owned objects differently; do not replace required extensions or helpers
with an empty baseline. Confirm the reviewed baseline from a clean local reset.
Expected: reset applies the foundations and privileges migrations successfully;
the smoke suite reports 53 passing assertions and `Result: PASS`; lint reports no
new warnings or errors. Run `pnpm db:test` again to confirm isolation and inspect
`pg_available_extensions` for `pg_partman`. These commands have not been run by Codex.

To inspect extension availability without changing schema:

```bash
pnpm exec supabase db query --local --sql "select name, default_version, installed_version from pg_available_extensions where name in ('pgcrypto', 'citext', 'pg_jsonschema', 'postgis', 'pg_cron', 'supabase_vault', 'pg_partman')"
```
