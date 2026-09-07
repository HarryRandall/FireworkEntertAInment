# UI and repository audit, 8 September 2026

Baseline: `origin/main` at `df5f7399`. The inventory covers 569 source modules,
128 component modules and 74 pages. Source inspection identified the findings
below; the route table records files and inherited boundaries, not a claim that
every authenticated workflow has been exercised in a browser.

## Research and decisions

- Dub separates application routes, feature UI and a shared UI package. Apply
  those ownership boundaries within this single Next.js application. Retain the
  root deployment layout and the current Node/npm tooling.
- Dub's button and Tailwind configuration demonstrate reusable variants and
  semantic surface/content tokens. Keep ShowCrafter's green identity, neutral
  workspace surfaces and existing shadcn/Radix primitives.
- Next.js 16 supports private `_components` folders and route groups without URL
  changes. Colocate route-only UI and promote actual shared features.

Sources: [Dub feature UI](https://github.com/dubinc/dub/tree/main/apps/web/ui),
[Dub shared UI](https://github.com/dubinc/dub/tree/main/packages/ui),
[Dub button](https://github.com/dubinc/dub/blob/main/packages/ui/src/button.tsx),
[Dub theme configuration](https://github.com/dubinc/dub/blob/main/apps/web/tailwind.config.ts),
and the installed Next.js 16 project-structure documentation. `app.dub.co`
redirected to login, so authenticated Dub screens were not inspected.

## Findings and completed changes

| Finding                                                             | Decision                                                                                                                                                                         |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin and My Store contain almost identical new-assortment dialogs  | One assortment feature with an explicit destination                                                                                                                              |
| My Store imports the editor from an admin route                     | Move the shared editor to `components/assortments`                                                                                                                               |
| Kiosk imports music search from the show wizard                     | Move music search to `components/music`                                                                                                                                          |
| Account-unavailable imports sign-out from settings                  | Move sign-out to `components/shell`                                                                                                                                              |
| Show summary imports random briefs from a route                     | Put shared brief data in `lib/shows`                                                                                                                                             |
| App/admin duplicate profile menus, theme picker and brand controls  | Extract shared shell components and reuse them in My Store                                                                                                                       |
| Route-only components live beside route entrypoints inconsistently  | Colocate them in `_components` and update callers/tests                                                                                                                          |
| Button and Input duplicate low-level implementations                | Compose the existing UI primitives while keeping public behaviour                                                                                                                |
| Four component modules initially had no runtime importers           | Removed after checking tests and references: EffectPreviewIcon, ShowTemplatePreview, ThemePreferenceField, ThemeToggle. Their unused CardBorderTrace dependency was also removed |
| Multiple colour blocks independently define overlapping values      | Centralise theme values and map legacy aliases to canonical tokens                                                                                                               |
| Root README and contributing guide duplicate setup and verification | README owns quick start; contributing owns workflow and service setup                                                                                                            |
| My Store and kiosk are missing from the root project overview       | Document their routes, ownership and preview limitations                                                                                                                         |

The first structure checkpoint removed 832 net lines while preserving all 74
URLs. App/admin/My Store now share `ProfileMenu` and `SidebarBrand`; My Store
and admin also share the assortment detail query, heading, editor and creation
dialog. A second lint pass found loading UI shared by parent and child show routes;
those components now live at their common `shows/_components` owner.

`styles/theme.css` now owns the light/dark palette. Compatibility names map to the
canonical surface, text and primary-action values. The dark sidebar's old blue
primary now follows ShowCrafter green. Status text has tested contrast against
its tinted surface in both themes. Button styling comes from the base UI variants,
Input/Textarea compose the base controls, and the unused Card elevation prop and
its callers are removed. Shared replay backgrounds use the stage token.

The root guides now have distinct roles: README for quick start and project
orientation, CONTRIBUTING for workflow/service setup, and architecture for UI
ownership, colour and page rules. AGENTS links to these rules. The new ESLint
checks reject upward UI dependencies, imports across private route subtrees and
raw colour utilities in shared controls/shells. Existing mock-ups remain reference
material, not production components.

## Boundaries and follow-up work

The 5,951-line renderer control file, large visual editors, replay canvas and
cover renderer have tightly coupled timing and persistence behaviour. A file's
length is a review signal, not sufficient reason to split its engine. They need
separate behaviour-led changes with renderer and persistence validation.

The import-render harness remains at `app/internal/import-render/ImportRenderHarness.tsx`.
Its path is hashed into sealed renderer evidence; moving it would require an
intentional app/worker/database contract update. This structural change leaves
that contract unchanged.

`RouteSkeletons` contains several domain-specific loading shapes. Preserve those
shapes; share a skeleton only when it represents the same content. Marketing,
authentication, full-screen kiosk and workspace pages also have different layouts.
Do not flatten their access or presentation boundaries into a universal page.

My Store's overview/activity and credit-purchase controls include preview data.
Keep that distinction visible; live billing and analytics are separate product
work. Redirect and placeholder pages are recorded below so consolidation does not
silently break old links or invent product capabilities.

## Complete page inventory

`Loading` and `Error` indicate an inherited file exists. Server permission checks,
API responses and data correctness require separate verification. A conditional
redirect classification includes normal pages that redirect for invalid input.

| URL                            | Group         | Source classification            | Loading | Error |
| ------------------------------ | ------------- | -------------------------------- | ------- | ----- |
| `/admin/assortments/[id]`      | `(admin)`     | page                             | yes     | yes   |
| `/admin/assortments`           | `(admin)`     | page                             | yes     | yes   |
| `/admin/catalogue`             | `(admin)`     | page                             | yes     | yes   |
| `/admin/effects/[id]`          | `(admin)`     | page                             | yes     | yes   |
| `/admin/effects/defaults/[id]` | `(admin)`     | page                             | yes     | yes   |
| `/admin/effects`               | `(admin)`     | page                             | yes     | yes   |
| `/admin/fireworks/[id]`        | `(admin)`     | page                             | yes     | yes   |
| `/admin/fireworks`             | `(admin)`     | redirect or conditional redirect | yes     | yes   |
| `/admin/imports/[id]`          | `(admin)`     | page                             | yes     | yes   |
| `/admin/imports`               | `(admin)`     | page                             | yes     | yes   |
| `/admin/multishots/[id]`       | `(admin)`     | page                             | yes     | yes   |
| `/admin/multishots`            | `(admin)`     | page                             | yes     | yes   |
| `/admin`                       | `(admin)`     | page                             | yes     | yes   |
| `/admin/prompts`               | `(admin)`     | redirect or conditional redirect | yes     | yes   |
| `/admin/roles`                 | `(admin)`     | redirect or conditional redirect | yes     | yes   |
| `/admin/show-presets/[id]`     | `(admin)`     | page                             | yes     | yes   |
| `/admin/show-presets`          | `(admin)`     | page                             | yes     | yes   |
| `/admin/suppliers`             | `(admin)`     | page                             | yes     | yes   |
| `/admin/users/[id]`            | `(admin)`     | page                             | yes     | yes   |
| `/admin/users`                 | `(admin)`     | page                             | yes     | yes   |
| `/dashboard`                   | `(app)`       | redirect or conditional redirect | no      | yes   |
| `/exports`                     | `(app)`       | page                             | no      | yes   |
| `/home`                        | `(app)`       | page                             | yes     | yes   |
| `/recommendations/[id]`        | `(app)`       | redirect or conditional redirect | no      | yes   |
| `/recommendations`             | `(app)`       | redirect or conditional redirect | no      | yes   |
| `/safety`                      | `(app)`       | page                             | no      | yes   |
| `/settings/billing`            | `(app)`       | page                             | yes     | yes   |
| `/settings/notifications`      | `(app)`       | page                             | yes     | yes   |
| `/settings`                    | `(app)`       | redirect or conditional redirect | yes     | yes   |
| `/settings/profile`            | `(app)`       | redirect or conditional redirect | yes     | yes   |
| `/settings/security`           | `(app)`       | page                             | yes     | yes   |
| `/settings/usage`              | `(app)`       | redirect or conditional redirect | yes     | yes   |
| `/shows/[id]/generating`       | `(app)`       | redirect or conditional redirect | yes     | yes   |
| `/shows/[id]`                  | `(app)`       | redirect or conditional redirect | yes     | yes   |
| `/shows/[id]/preview`          | `(app)`       | redirect or conditional redirect | yes     | yes   |
| `/shows/[id]/shopping-list`    | `(app)`       | redirect or conditional redirect | yes     | yes   |
| `/shows/[id]/show-guide`       | `(app)`       | redirect or conditional redirect | yes     | yes   |
| `/shows/[id]/timeline`         | `(app)`       | redirect or conditional redirect | yes     | yes   |
| `/shows/new`                   | `(app)`       | page                             | yes     | yes   |
| `/shows`                       | `(app)`       | page                             | yes     | yes   |
| `/login`                       | `(auth)`      | page                             | no      | no    |
| `/signup`                      | `(auth)`      | page                             | no      | no    |
| `/catalogue`                   | `(browse)`    | page                             | yes     | yes   |
| `/library/[id]`                | `(browse)`    | page                             | yes     | yes   |
| `/library`                     | `(browse)`    | page                             | yes     | yes   |
| `/a/[token]`                   | `(kiosk)`     | page                             | no      | no    |
| `/a/[token]/show/[showToken]`  | `(kiosk)`     | page                             | no      | no    |
| `/about`                       | `(marketing)` | page                             | no      | no    |
| `/account-unavailable`         | `(marketing)` | page                             | no      | no    |
| `/careers`                     | `(marketing)` | placeholder                      | no      | no    |
| `/changelog`                   | `(marketing)` | placeholder                      | no      | no    |
| `/contact`                     | `(marketing)` | page                             | no      | no    |
| `/cookies`                     | `(marketing)` | placeholder                      | no      | no    |
| `/docs`                        | `(marketing)` | placeholder                      | no      | no    |
| `/features`                    | `(marketing)` | page                             | no      | no    |
| `/forgot-password`             | `(marketing)` | page                             | no      | no    |
| `/how-it-works`                | `(marketing)` | page                             | no      | no    |
| `/licences`                    | `(marketing)` | placeholder                      | no      | no    |
| `/`                            | `(marketing)` | page                             | no      | no    |
| `/press`                       | `(marketing)` | page                             | no      | no    |
| `/pricing`                     | `(marketing)` | page                             | no      | no    |
| `/privacy`                     | `(marketing)` | placeholder                      | no      | no    |
| `/reset-password/confirm`      | `(marketing)` | page                             | yes     | no    |
| `/reset-password`              | `(marketing)` | page                             | yes     | no    |
| `/status`                      | `(marketing)` | page                             | no      | no    |
| `/terms`                       | `(marketing)` | placeholder                      | no      | no    |
| `/tutorials`                   | `(marketing)` | placeholder                      | no      | no    |
| `/vendors`                     | `(marketing)` | redirect or conditional redirect | no      | no    |
| `/my-store/assortments/[id]`   | `(my-store)`  | page                             | yes     | yes   |
| `/my-store/assortments`        | `(my-store)`  | page                             | yes     | yes   |
| `/my-store/credits`            | `(my-store)`  | page                             | yes     | yes   |
| `/my-store`                    | `(my-store)`  | page                             | yes     | yes   |
| `/my-store/test-show`          | `(my-store)`  | page                             | yes     | yes   |
| `/internal/import-render`      | `internal`    | page                             | no      | no    |

## Verification record

- Baseline: `npm run check` passed 677 tests and the production build.
- Structure checkpoint: TypeScript, lint, all 679 application tests and all 68
  firework worker tests passed. The route URLs are unchanged.
- Browser: the real shared components rendered in an isolated, temporary local
  fixture. Checked app/admin/My Store shells, light/dark themes, 390px mobile
  layout, sidebar drawer, account menu, input/error states, dialog open/close,
  field entry and create-button enablement. The actual `/login` route and its
  relocated stylesheet also rendered correctly. No assortment was created.
- The disabled-link keyboard interaction could not be driven by the browser
  tool, which timed out on the disabled control. Its busy/disabled rendering was
  visible, and the existing source-level interaction guard still passes.
- Browser coverage used fixture identities, not a live authenticated account.
  Full catalogue, generation, billing and retailer data workflows were not
  exercised. These changes do not deploy services or apply migrations.
- Final: `npm run check` passed formatting, ESLint, TypeScript, all 686 application
  tests and the production build. The worker contract and generated UI files are
  unchanged.
- Final inventory: 567 source modules, 130 shared component modules and 74 pages.
  No component modules lack importers, and there are no cross-route-group imports.
  The complete URL list matches the baseline. Referenced modules may still contain
  unused exports; the audit does not prove every export is needed.
