---
name: showcrafter-data
description: Change ShowCrafter Supabase schema, data access or permission boundaries. Use for schema files, queries, RLS, privileged RPCs, storage, schedules and ownership checks.
---

# ShowCrafter data

The schema is declarative: one SQL file per domain in `supabase/schemas/`, listed in
`supabase/config.toml` `schema_paths`. A generated baseline migration creates it;
hand-write migrations only for what diffing misses (auth triggers, storage policies,
`pg_cron` schedules, grants). Follow [the database guide](../../../docs/database.md).

During the rebuild everything runs against local Supabase (`pnpm db:setup`,
`pnpm db:test`). Never link, push to or reset a hosted project; the production reset
happens only through the switch-over runbook.

Rules:

- Every retailer-owned row carries `organisation_id` (and `store_id` where it applies),
  indexed, with RLS that checks membership through the `private` helpers.
- Published content is versioned and immutable; change it by publishing a new version.
- Money is `bigint` minor units plus a `char(3)` currency.
- Security-definer functions live in `private`, set `search_path = ''`, and are granted
  narrowly. Revoke default privileges.
- Multi-row writes go through transactional RPCs. Do not turn read errors into empty
  results or permissive defaults.
- Keep browser, server, public and service-role clients distinct. Never expose the
  service-role key or authorise from editable user metadata.

Every policy needs a pgTAP test with one allowed and one denied case, acting as the
relevant personas (staff, owner, manager, another organisation, anonymous shopper,
signed-in shopper, supplier member). Regenerate types after a schema change.
