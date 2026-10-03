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
relevant caller roles, including staff, organisation members, suppliers, shoppers and
