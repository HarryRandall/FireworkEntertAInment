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

## Framework evidence

Check the installed framework version and its bundled docs before changing a
framework convention. If the docs are absent, use the matching official version.
Use Context7 only for an unresolved library question and state the library/version.
Never include credentials, personal data or private source in documentation queries.
Read implementation and callers; documentation examples still need adaptation.

## Component readability

Keep pages and layouts as server data/composition boundaries. Put interactive state
and browser lifecycles in small client components. Route-owned components stay in
their route's \_components folder; shared behaviour belongs to its domain.

Extract a component for an interaction or visual region, not for each div. Extract
pure domain computations from render functions. Use hooks for cohesive state or
external-system lifecycles, not to hide arbitrary helpers. Derive values during
render; effects synchronise with external systems and clean up their resources.

Validate action input, recheck access and keep expected validation errors distinct
from unexpected failures. Never replace failed ownership, credit or data reads with
successful empty values. Keep loading, empty and error states explicit.

Preserve the Next, React Hooks and architecture lint checks. Do not add global
purity, immutability or effect exemptions. Explain any necessary local exception
and include it in the commit plan for the composer.
