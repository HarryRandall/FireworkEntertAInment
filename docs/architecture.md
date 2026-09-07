# Architecture and UI conventions

ShowCrafter is a pnpm workspace with one Next.js application in `apps/web` and
two independently deployed Python services. The repository root owns shared
workflow configuration, documentation and the lockfile. App configuration stays
with the app. Add packages only when independently owned or shared code justifies
them; one app does not need a placeholder package hierarchy.

## Where code belongs

| Location                    | Responsibility                                                                           |
| --------------------------- | ---------------------------------------------------------------------------------------- |
| `app/`                      | Routes, layouts, metadata, loading and error boundaries, API handlers and server actions |
| `app/**/_components/`       | UI used only by that route or its descendants                                            |
| `components/ui/`            | Low-level shadcn/Radix primitives; respect generated-file headers                        |
| `components/design-system/` | ShowCrafter's reusable controls and patterns, built from primitives                      |
| `components/<domain>/`      | Features shared by multiple routes, such as assortments, music selection and replay      |
| `components/shell/`         | App, admin and My Store navigation, account controls and workspace chrome                |
| `lib/`                      | Domain transformations, validation, types and server integrations                        |
| `styles/theme.css`          | Canonical light/dark colour values and legacy aliases                                    |
| `hooks/`                    | Hooks shared across domains; feature-only hooks stay beside their feature                |
| `lib/supabase/`             | Existing Supabase client factories and request/session adapters                          |
| `services/`                 | Independently deployed Python services with their own requirements                       |
| `supabase/`                 | Migrations, templates, catalogue tooling and database tests                              |
| `tests/`                    | Behaviour and contract tests grouped by domain                                           |
| `docs/`                     | Maintained architecture and development guidance                                         |

Paths in this table are relative to `apps/web`, except `services`, `supabase`
and `docs`, which are repository folders. App scripts, including the audit and
ESLint rules, live together in `apps/web/scripts`. Project-specific agent
workflows live in `.agents/skills`.

Dependencies flow from routes to features to design-system components to UI
primitives. Shared components must not import a route's implementation. Move a
feature to its domain when a second route needs it. Client components may import
an explicit server action from `app/actions/`; server-only modules must remain
outside client bundles. Keep permission and ownership checks at server boundaries.

Route groups organise layouts without changing URLs. Use `_components` for
route-local React components; keep `page`, `layout`, `loading`, `error` and route
handlers at their Next.js locations. The import-render harness retains its
fingerprinted path because a move invalidates sealed renderer evidence. Shared
features should take explicit inputs, such as an assortment destination, instead
of inferring an admin persona.

## Reuse and presentation

Search existing callers before creating a control. Use the design-system Button
for actions with links/loading, Input/Textarea for plain fields, Field for labels,
SelectField for rich selects, Badge for status, SectionHeader for headings,
DataTable/FilterBar/TablePagination for lists, and Feedback for empty, loading and
failure states. Use raw UI primitives when composing a new pattern. A wrapper
must add a real behaviour or composition; do not duplicate the underlying styles.

Keep the established compact layout, Geist typography, neutral surfaces, thin
borders and restrained shadows. Use green for ShowCrafter's primary actions and
brand highlights. The `accent` token is the neutral hover/selection surface;
`primary` is the brand action colour. Colours for success, warning, danger and
information have semantic meanings. Firework/show palettes and marketing artwork
are content, and may have their own colours.

| Purpose                 | Tailwind tokens                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------- |
| Page and panel surfaces | `bg-background`, `bg-card`, `bg-popover`, `bg-muted`                                   |
| Text                    | `text-foreground`, `text-muted-foreground`                                             |
| Lines and focus         | `border-border`, `border-input`, `ring-ring`                                           |
| Primary action          | `bg-primary`, `text-primary-foreground`                                                |
| Brand highlight         | `bg-hl`, `bg-hl-soft`, `text-hl-ink`                                                   |
| Status                  | `text-status-success`, `text-status-warning`, `text-status-danger`, `text-status-info` |

Maintain colour values and their light/dark counterparts together in
`styles/theme.css`. Prefer semantic tokens over literal hex values and palette
classes in application UI. Legacy colour aliases are compatibility mappings, not
a second palette. Check light, dark, mobile, focus, disabled/loading and
reduced-motion states when changing a shared primitive.

Use `SectionHeader as="h1"` for a page heading and its default `h2` for sections.
Every page needs a meaningful heading, honest empty/error/loading states, and
an intentional access boundary. A navigation item does not grant permission.
Preview-only My Store metrics and credit top-ups must remain labelled as previews.
Keep old redirect URLs working when consolidating pages.

ESLint blocks imports from another route subtree, upward dependencies from UI
primitives/patterns, and literal colour utilities in shared controls and shells.
The tests exercise these boundaries, including relative and dynamic imports.

## Reference and maintenance

The structure follows the separation visible in [Dub's feature UI](https://github.com/dubinc/dub/tree/main/apps/web/ui),
[shared UI package](https://github.com/dubinc/dub/tree/main/packages/ui) and
[shared Tailwind configuration](https://github.com/dubinc/dub/blob/main/apps/web/tailwind.config.ts).
Dub's components and neutral visual hierarchy inform the organisation; ShowCrafter
keeps its own brand and the existing Radix/shadcn foundation.

Next.js 16's version-matched project-structure documentation is installed at
`apps/web/node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md`.
Read it before changing route conventions.

Run `pnpm audit:ui` for the page inventory and import review, or add `-- --json`
for machine-readable paths. The audit identifies candidates, not safe deletions:
check runtime imports, re-exports and tests before removing a component. Use
`pnpm check` for the delivery gate.
