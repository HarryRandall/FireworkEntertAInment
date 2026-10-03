---
name: showcrafter-web
description: Implement or refactor ShowCrafter web routes, components and application code in apps/web. Use for web changes in the Next.js application.
---

# ShowCrafter web

The app is `apps/web`. From the root, `pnpm dev` and `pnpm check` are shortcuts; other
scripts use `pnpm --filter @showcrafter/web <script>`. Read
[architecture](../../../docs/architecture.md) for the route areas and ownership, and
the installed Next.js docs under `apps/web/node_modules/next/dist/docs/` before
changing framework conventions.

Areas: **shopper** (QR resolution, store and product pages, planner, lists, account),
**retailer**, **supplier** and **admin**. Access is enforced on the server (layouts,
server actions, RLS); a navigation item is not an access boundary. Shoppers are
Supabase anonymous users until they add an email.

Supabase clients are typed per trust level in `apps/web/lib/supabase/` (browser,
server, public, service role). Keep service-role clients and server integrations out
of client bundles. Public shopper data comes through the security-definer RPCs, not
direct table reads.

Code rules:

- TypeScript strict. Use `unknown`, narrowing, discriminated unions or Zod at external
  boundaries; avoid `any`, unchecked casts, non-null assertions and suppressions.
- Default to Server Components. Parse server-action input, recheck permissions and
  revalidate affected views after a write.
- Keep side effects at boundaries and derive values during render; effects only
  synchronise with external systems and clean up after themselves.
- Database, authorisation, billing and ownership read failures stay failures.
- Do not hand-edit generated files (database types, schema-derived Zod).

Tests exercise behaviour, not source text. For interface work also read
[the UI workflow](../showcrafter-ui/SKILL.md).
