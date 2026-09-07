---
name: showcrafter-data
description: Change ShowCrafter Supabase schema, data access or permission boundaries. Use for database migrations, queries, RLS, privileged RPCs and ownership checks.
---

# ShowCrafter data

Database history, seeds and SQL tests live in `supabase/`. The web app's client
factories live in `apps/web/lib/supabase/`; generated types are
`apps/web/lib/database.types.ts`. Read the current migration and caller before
assuming a table, column, policy or grant exists.

Use current Supabase documentation for APIs and CLI syntax. Keep user-scoped,
public and service-role clients distinct. Never expose a service-role key or
use editable user metadata for authorisation. A navigation item is not an
access boundary.

Every exposed table needs RLS and intentional policies. Privileged RPCs need
explicit caller/ownership checks, revoked public execution and narrow grants.
Keep multi-write invariants transactional. Do not turn read errors into empty
results or permissive defaults.

Preserve migration history; use a new migration for an intentional schema
change. Regenerate database types after schema changes. Catalogue generation
lives in `apps/web/scripts/generate-firework-catalogue-migration.mjs`; inspect its
output destination before running it because it writes migration SQL.

Use [development guidance](../../../../docs/development.md) for local database and
service checks. Exercise changed SQL/policies with the relevant tests and verify
both allowed and denied access. Distinguish local validation from linked/production
work; a code refactor does not itself require a remote database change.
