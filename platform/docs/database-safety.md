# Database Safety

The application schema is the chronological migration history under
`supabase/migrations`. Generated client types in `lib/database.types.ts` must
match the applied target schema.

## Author A Migration

1. Inspect the live migrations, generated types, calling routes, actions, and
   tests before choosing a schema change.
2. Create a uniquely timestamped file with `supabase migration new <name>`.
3. Preflight existing rows before adding `NOT NULL`, checks, uniqueness, or
   foreign keys. Repair data explicitly or fail with a useful assertion.
4. Add indexes for foreign-key, cascade, ownership, and common join paths.
   Remove only indexes proven redundant by the same useful leading columns.
5. Add or update focused migration and access-path tests.
6. Apply the migration, regenerate `lib/database.types.ts`, and review the type
   diff. Never hand-maintain schema drift in the generated file.

Do not edit a migration already applied to a linked environment. Add a new
forward migration.

## RLS And Grants

RLS and SQL privileges are separate layers. Every exposed public table needs
RLS, an explicit policy for each intended operation, and least-privilege Data
API grants.

- Grant `anon` only the reads required by documented public browse routes.
- Prefer column grants when an otherwise-public table contains private admin
  provenance such as `show_presets.source_show_id`.
- Grant `authenticated` only the reads and writes used by an ownership or
  permission-checked path.
- Revoke unused write, `TRUNCATE`, `REFERENCES`, and `TRIGGER` privileges.
- Set safe default privileges so future tables and functions do not inherit
  broad access.
- Keep service-role access server-only.

An application action is not a database invariant. Published Explore rows must
also be protected by checks or a trigger that rejects empty, malformed,
unresolved, overlapping, or out-of-duration cues on direct Data API writes.
Derived multishot shot count and minimum duration belong in a transactional
database path so a failed follow-up update cannot leave catalogue timing stale.

Use `(select auth.uid())` for user ownership and
`public.current_user_has_permission(...)` for admin authorisation. Do not use
editable user metadata as an authorisation source.

## Functions And Views

Treat every `SECURITY DEFINER` function as an access boundary:

- Set `search_path = ''` and schema-qualify every referenced object.
- Check the caller inside the function.
- Revoke execute from `public` and any unneeded Data API role.
- Grant execute only to the required role.
- Revoke execute on trigger-only and internal helper functions.
- Test both allowed and denied calls.

Cancellation RPCs that coordinate data, storage and credits must lock the
owned row, reject resources already referenced by durable work, and resolve an
active reservation in the same transaction. Completed work is chargeable;
cleanup must not become a refund-abuse path.

Use `security_invoker = true` for an exposed view on supported Postgres
versions, or keep the view inaccessible to Data API roles.

## Linked Environment Delivery

Before a remote push:

```bash
supabase migration list --linked
supabase db push --linked --dry-run
```

Run the narrowest relevant application tests before applying. Review the
dry-run file list and stop on unexpected or out-of-order migrations.

After an authorised push:

```bash
supabase migration list --linked
supabase db lint --linked
supabase db advisors --linked
```

Then run focused read-only queries to verify the new objects, policies, grants,
constraints, indexes, and repaired row counts. Report local checks, linked
checks, and remote execution separately.

Triage advisor output by the actual Data API roles before changing policies.
Guarded `SECURITY DEFINER` RPCs can be intentional when they enforce the caller
inside the function and expose only a narrow authenticated grant. The
`reserve_ai_credits` `p_amount` parameter remains in the public signature for
caller compatibility but is deliberately ignored in favour of the server-owned
cost table. Supabase leaked-password protection is a Pro-plan Auth setting, not
a SQL migration; enable it in the project Auth settings when the plan supports
it.
