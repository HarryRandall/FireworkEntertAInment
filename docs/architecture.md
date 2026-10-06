# Architecture and UI conventions

ShowCrafter is a pnpm workspace with one Next.js application in `apps/web` and
two independently deployed Python services. The repository root owns shared
workflow configuration, documentation and the lockfile. App configuration stays
with the app. Add packages only when independently owned or shared code justifies
them; one app does not need a placeholder package hierarchy.

## Where code belongs

| Location              | Responsibility                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------- |
| `app/`                | Routes, layouts, metadata, loading and error boundaries, API handlers and server actions |
| `app/**/_components/` | UI used only by that route or its descendants                                            |
| `ui/primitives/`      | Low-level shadcn/Radix primitives; respect generated-file headers                        |
| `ui/patterns/`        | ShowCrafter's reusable controls and patterns, built from primitives                      |
| `ui/<domain>/`        | Features shared by multiple routes, such as assortments, firework editing and replay     |
| `ui/shell/`           | App, admin and My Store navigation, account controls and workspace chrome                |
| `lib/`                | Domain transformations, validation, types and server integrations                        |
| `ui/theme.css`        | Canonical light/dark colour values and theme tokens                                      |
| `hooks/`              | Hooks shared across domains; feature-only hooks stay beside their feature                |
| `lib/supabase/`       | Existing Supabase client factories and request/session adapters                          |
| `services/`           | Independently deployed Python services with their own requirements                       |
| `supabase/`           | Migrations, templates, catalogue tooling and database tests                              |
| `tests/`              | Behaviour and contract tests grouped by domain                                           |
| `docs/`               | Maintained architecture and development guidance                                         |

Paths in this table are relative to `apps/web`, except `services`, `supabase`
and `docs`, which are repository folders. App scripts, including the audit and
ESLint rules, live together in `apps/web/scripts`. Project-specific agent
workflows live in `.agents/skills`. Repository presentation media belongs in
`.github/assets`; browser-capture working files remain ignored under `output/`.

Within `lib`, `auth` owns session, authenticated identity, redirect and recovery
helpers; `access` owns current-profile, effective-permission and impersonation
context; `supabase` owns client construction; `admin` owns reusable
permission-checked management queries; and
`cue-generation`, `fireworks`, `firework-import`, `assortments`, `show-templates`
and `shows` own their domain logic. Public template reads stay in
`show-templates`; route-specific admin show-preset reads stay beside the
`app/(admin)/admin/show-presets` route.
Import the owning module directly. Do not restore compatibility forwarding files
or broad barrels that pull unrelated server and client modules into one API.
Shared firework editor controls, history and fullscreen preview behaviour live in
`ui/firework-editor`; the domain name reflects their reuse outside admin routes.

Both Python services are active application dependencies. Music upload and
generation call `ANALYSER_URL` through `lib/show-analysis-runner.server.ts`;
video imports call `FIREWORK_IMPORT_URL` through
`lib/firework-import/trigger.server.ts`. Their Modal entry points, local worker,
browser smoke check and regression fixtures support those paths.

Keep Supabase migration history, recovery email templates and SQL contract
tests. Optional renderer QA data lives in `supabase/seeds/renderer-qa.sql`;
it is a manual development fixture, not a production seed step.

Dependencies flow from routes to features to reusable patterns to UI
primitives. Shared components must not import a route's implementation. Move a
feature to its domain when a second route needs it. Keep route-specific Server
Actions beside their route and shared Server Actions in the owning `lib` domain;
do not recreate a central `app/actions` folder. Server-only modules must remain
outside client bundles. Use `./` or `../` for nearby files and the `@/` alias when
an import would otherwise need multiple parent traversals. Keep permission and
ownership checks at server boundaries.

App, admin and My Store use `WorkspaceShell` and `WorkspaceContent` for the
sidebar state, theme, skip target and scrolling frame. Each shell supplies its
navigation and header. Admin and My Store share the assortment list and editor;
their route modules supply the destination while server layouts enforce access.

Route groups organise layouts without changing URLs. Use `_components` for
route-local React components; keep `page`, `layout`, `loading`, `error` and route
handlers at their Next.js locations. The import-render harness remains a route
while its reconstruction, review, authentication, metrics and renderer contract
live in `lib/firework-import`. Fingerprinted source paths are part of sealed
renderer evidence and must change only through a coordinated app, worker and
database contract update. Shared features should take explicit inputs, such as
an assortment destination, instead of inferring an admin persona.

## Reuse and presentation

Search existing callers before creating a control. Use the shared pattern Button
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
`ui/theme.css`. Prefer semantic tokens over literal hex values and palette
classes in application UI. Use the token classes above rather than
`[color:var(--…)]` or Material-style names such as `text-on-surface`;
`architecture/legacy-colours` enforces this. Check light, dark, mobile, focus, disabled/loading and
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

## Renderer library

`packages/renderer` (`@showcrafter/renderer`) owns its v1 design schema, pinned
Zod 3 validators, deterministic simulation, templates, posters and WebGL viewer.
The admin renderer preview loads its browser view without server rendering.
Shows plan and play stored designs through the renderer library. The legacy
`packages/fireworks` and `packages/firework-editor` remain for admin editors and
the video import harness. Keep its validators separate from web
Zod 4 schemas.

## Renderer design storage

`firework_effects.design` and `fireworks.design` optionally store complete renderer
v1 documents alongside their existing rendering fields. `design_schema` is fixed
at 1. PostgreSQL validates documents with `pg_jsonschema` and the generated
`private.firework_design_schema()` helper. Effect `template_key` values are unique
when present. Existing snapshot triggers and editor RPC field allowlists retain
their current behaviour. The admin renderer comparison reads these designs;
show generation and replay validate stored designs and use the renderer library.

`catalogue_items.finale_product_id` identifies a Finale 3D supplier product;
null means there is no equivalent yet. `finale_effect_name` is optional. The
initial mapping copies `part_number` only for manufacturer-labelled products.
Existing table grants and RLS apply to all these columns, including listed public
catalogue reads and catalogue administrator writes.

`pnpm db:design-schema --check`, included in `pnpm check`, rejects a stale SQL
schema. After changing the JSON Schema, run
`pnpm db:design-schema --migration <YYYYMMDDHHMMSS>` to emit a new migration
without rewriting history. The migration revalidates existing designs, so inspect
compatibility before applying it. Bootstrap snapshots include the design and
Finale columns explicitly.

## Show design resolution

`lib/shows/renderer-design.ts` validates stored v1 documents through `upgradeDesign`
and resolves one shared adjustment table for planning and replay. Missing or invalid
designs are visible errors. Shells and rockets compensate `launch.time_s`; mines and
all ground kinds fire on their musical impact. Durations use `shotDuration`, including
each expanded multishot child. Occupancy reserves the peak-adjusted duration.

Calibre uses a 75 mm baseline: up to 30/50/60/75/100/125 mm maps to
-3/-2/-1/0/+1/+2, with larger sizes at +3. Unknown calibre stays at zero.
The renderer registry applies launch height at 1.12 per level, lift time by the
square root of that factor and layer radius at 1.15 per level. Accent and peak add
one and two size/brightness levels respectively, clamped with stored adjustments to
-3..3. Brightness uses the package's 1.2 per-level multiplier and flash uses 1.3.

`ShowRendererCanvas` adapts the soundtrack-owned playhead to `Viewer.syncTime`.
It uses stateless simulation for seeks, with no show snapshot cache. Saved launch
positions use legacy centimetres and convert once at 0.01 metres per unit. New
site-width layouts convert feet to centimetres before persistence. The legacy
`FireworkReplayCanvas` remains the fingerprinted admin editor and import surface;
admin style-default previews explicitly declare that editor renderer.

Catalogue posters use the detached package poster API and retain 1600 by 1000
physical-pixel WebP uploads, immutable paths and revision/signature race checks.
Renderer design edits invalidate their own posters and dependent multishot posters.
Copied fireworks remain independent of later source-effect changes.
