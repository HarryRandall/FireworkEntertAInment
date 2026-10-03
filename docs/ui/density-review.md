# Prototype typography and density review

The shared theme, primitives, kit and workspace shell now use the prototype's
14 px body, Geist, 13 px button/label text, 32 px actions and 36 px fields.
No route-specific Studio or catalogue presentation overrides were added.

Reference files read only: `shared.css`, `kit.css`, `workspace.css` and
`components.html` in `/Users/harry/projects/FireworkEntertAInment-reference/docs/design/redesign-2026-09/prototype/`.

## Token changes

All dimensions below are CSS pixels. Rem remains 16 px, so existing layout widths
and responsive breakpoints do not shrink with the body text. The previous type
values were Tailwind defaults. Unitless line-height values are followed by their
computed pixel values.

| Token                      | Before                                                      | After                                       |
| -------------------------- | ----------------------------------------------------------- | ------------------------------------------- |
| `--text-xs`                | 0.75rem = 12                                                | 12px (explicit, same size)                  |
| `--text-xs--line-height`   | 1.3333 = 16                                                 | 1.5 = 18                                    |
| `--text-sm`                | 0.875rem = 14                                               | 13px                                        |
| `--text-sm--line-height`   | 1.4286 = 20                                                 | 1.5 = 19.5                                  |
| `--text-base`              | 1rem = 16                                                   | 14px                                        |
| `--text-base--line-height` | 1.5 = 24                                                    | 1.5 = 21                                    |
| `--text-lg`                | 1.125rem = 18                                               | 15px                                        |
| `--text-lg--line-height`   | 1.5556 = 28                                                 | 1.5 = 22.5                                  |
| `--text-xl`                | 1.25rem = 20                                                | 20px (explicit, same size)                  |
| `--text-xl--line-height`   | 1.4 = 28                                                    | 1.5 = 30                                    |
| `--text-2xl`               | 1.5rem = 24                                                 | 22px                                        |
| `--text-2xl--line-height`  | 1.3333 = 32                                                 | 1.5 = 33                                    |
| `--text-3xl`               | 1.875rem = 30                                               | 28px                                        |
| `--text-3xl--line-height`  | 1.2 = 36                                                    | 1.5 = 42                                    |
| `--radius-md`              | `(8 + 12) / 2` = 10                                         | `--radius-small` = 8                        |
| `--radius-xl`              | `12 + (12 - 8)` = 16                                        | `--radius` = 12                             |
| `--control-height`         | Absent; default button 36, small 32                         | 32px                                        |
| `--control-large-height`   | Absent; large button 40                                     | 40px                                        |
| `--field-height`           | Absent; input about 38 from line-height, padding and border | 36px                                        |
| `--field-padding`          | Absent; input horizontal padding 12                         | 11px                                        |
| `--textarea-min-height`    | Absent; minimum 80                                          | 84px                                        |
| `--card-padding`           | Absent; choice/stat cards 16, callout/list rows 12          | 14px                                        |
| `--card-gap`               | Absent; choice/product/callout gaps 12                      | 10px                                        |
| `--product-tile-min-width` | Absent; two/four fixed columns                              | 136px, auto-fill within available container |
| `--layer-row-height`       | Absent; selection about 36, icon controls 32                | 30px minimum                                |
| `--layer-control-size`     | Absent; 32                                                  | 24px                                        |
| `--sc-beam-inset`          | Circular `var(--sc-beam-inset)`, invalid                    | 1px                                         |

Palette, shadows, 12 px card radius and 8 px small-control radius already matched
and were retained. The chart palette references were corrected from undefined
`--warn` and `--danger` to existing `--warning` and `--destructive`.

## Shared presentation changes

| Surface                      | Before                                                                        | After                                                                                              |
| ---------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Body font                    | `var(--font-sans)` resolved to system UI in supplied screenshot               | Geist's generated class plus direct `--font-geist-sans` family                                     |
| Body text                    | Browser default 16/24                                                         | 14/21                                                                                              |
| h1/h2/h3 tracking            | No global tracking/balancing                                                  | -0.01em, balanced wrapping                                                                         |
| Default/small buttons        | 36/32 high, 10 horizontal padding, 14 text, 10 radius                         | 32 high, 12 padding, 13 text, 8 radius                                                             |
| Small button gap             | 4                                                                             | 6                                                                                                  |
| Large button                 | 40 high, 10 padding, 14 text                                                  | 40 high, 16 padding, 14 text                                                                       |
| Default icon button          | 36 square                                                                     | 32 square                                                                                          |
| Input/select                 | About 38 high, 12 horizontal and 8 vertical padding, 14 text                  | 36 high, 11 horizontal and no vertical padding, 14 text                                            |
| Textarea                     | 80 minimum, 12/8 horizontal/vertical padding, 20 text line-height             | 84 minimum, 11/9 padding, 20.3 line-height                                                         |
| Input group                  | Content-derived height, transparent addons, 12 addon padding, input padding 0 | 36 outer height, muted separated addons, 10 addon padding, 11 input padding; absent addons omitted |
| Choice cards                 | 16 padding, 12 gap, 14/500 title                                              | 14 padding, 10 gap, 14/600 title                                                                   |
| Checkbox tiles at 390 px     | Two columns                                                                   | One column, matching the compact prototype breakpoint                                              |
| Choice chips                 | About 30 high, 12 text                                                        | Minimum 32 high, 13 text                                                                           |
| Tag input                    | Minimum 40, padding 8                                                         | Minimum 36, padding 5 vertical/8 horizontal                                                        |
| Tags                         | About 22 high, 12 text, 8 horizontal padding, 4 radius                        | 24 high, 12.5 text, 8 left/4 right padding, 6 radius                                               |
| Tag entry                    | Minimum width 96, natural height, 14 text                                     | Minimum width 140, height 24, 14 text                                                              |
| Slider                       | Gap 12, sans output 14                                                        | Gap 8, mono output 12.5                                                                            |
| Stepper output               | Minimum width 40, text 14                                                     | Minimum width 36, text 13                                                                          |
| Callout                      | Padding 12, gap 12, message margin 4 and foreground text                      | Padding 12 vertical/14 horizontal, gap 10, margin 2 and muted message                              |
| Badge                        | About 22 high with border and vertical padding                                | Minimum 22, no border or vertical padding                                                          |
| Stat card                    | Padding 16, gap 12, value 24                                                  | Padding 14, gap 8, value 22                                                                        |
| List row                     | Padding 12, icon 36, title 14/500                                             | Padding 12 vertical/14 horizontal, icon 34, title 13.5/600                                         |
| Settings section             | Vertical padding 24, gap 20                                                   | Padding 16, gap 16                                                                                 |
| Grid cell                    | Vertical padding 12, text 14                                                  | Padding 10, text 13                                                                                |
| Product picker               | Fixed 2/4 columns, gap 12                                                     | Auto-fill, minimum tile width 136, gap 10                                                          |
| Product tile content         | Padding 12, gap 4, title 14/500                                               | Padding 8 top/10 sides and bottom, gap 2, title 13/600                                             |
| Planned show title           | 16                                                                            | 15                                                                                                 |
| Layer list                   | Row gap 2, action/placeholder width 32, selection vertical padding 8          | Gap 1, action/placeholder width 24, minimum selection height 30 without vertical padding           |
| Keyboard key                 | Padding 6 horizontal/2 vertical, text 12, radius 4                            | Height 20, horizontal padding 5, no vertical padding, text 11, radius 5                            |
| Shelf label                  | `72px 1fr` tracks; unbroken title could widen label                           | `72px minmax(0, 1fr)` tracks; title can wrap anywhere                                              |
| Sidebar content              | Gap 8                                                                         | Gap 3                                                                                              |
| Sidebar picker               | Padding 8                                                                     | Padding 7 vertical/8 horizontal                                                                    |
| Sidebar heading              | Padding 8, weight 600                                                         | Padding 4 top/8 sides and bottom, weight 650                                                       |
| Sidebar links                | Padding 7 vertical/8 horizontal, text 13                                      | Minimum height 32, padding 0 vertical/8 horizontal, text 13.5                                      |
| Breadcrumb                   | Ordinary word wrapping                                                        | Can wrap long unbroken titles                                                                      |
| Gallery example wrapper      | Documentation inside bordered card; separate 20 px header/body padding        | Documentation outside card, prototype 24 px demo padding, 12 px card radius                        |
| Gallery example title/source | 16/12                                                                         | 15/11.5                                                                                            |
| Gallery example internal gap | 20                                                                            | 16                                                                                                 |
| Gallery state                | Gap 12, label 12/500, tracking 0.025em                                        | Gap 6, label 10/600, tracking 0.08em                                                               |
| Gallery section              | Gap 20; heading without divider                                               | Gap 18; heading with divider and 8 bottom padding                                                  |

The root document now uses `en-GB`. This is independent of the visual tokens.

## Runtime investigation

Three concrete chart defects were addressed:

1. The warning series used undefined `--warn`.
2. The danger series used undefined `--danger`.
3. React Spring reparsed the heatmap's nested CSS colour expression and changed
   its SVG fill during hydration. A non-animated SVG cell now forwards the CSS
   colour directly and retains Nivo's hover/click callbacks and cell geometry.

The source audit and server render found no nested buttons, block elements inside
paragraphs or key warnings in the gallery. A temporary Node/Happy DOM harness
rendered and hydrated the gallery. Replacing responsive chart wrappers with
fixed-size equivalents in that harness exposed the heatmap attribute mismatch;
with the fix the same harness reports zero recoverable hydration errors and no
attribute mismatch warning. The DOM substitute cannot create WebGL contexts, so
it reports the expected `THREE.WebGLRenderer: Error creating WebGL context`.
It is not a browser or a visual layout test.

These fixes are not proof that the screenshot's exact three overlay entries have
all been cleared. Their individual messages were unavailable, and no browser or
dev server was run. The composer must inspect the overlay in the real app.

## Acceptance and verification

- Source review: shell stacks at 640 px; Studio panels stack at 980 px; catalogue
  tables retain their local horizontal scroller; shopper tiles adapt to their
  container width; shelf labels allow their text track to shrink and wrap.
- Built CSS inspection: body references the emitted `--text-base:14px`; generated
  font CSS supplies Geist; button/field utility rules resolve the shared heights.
- `pnpm exec prettier --write` was restricted to changed files.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm knip`, `pnpm test`
  and `pnpm build` passed. Web tests: 93 passed, zero failed/skipped.
- Knip emitted its existing configuration hint about excluded `.css` imports.
- `git diff --check` passed.
- Full `pnpm check` was not run because it includes the prohibited browser suite.
  Database and Python suites were not run; their code/contracts were not changed.
- No new screenshots, browser tests, dev server, CI or production verification.
  Desktop/390 px in both themes, keyboard/focus states, Studio transport/inspector,
  catalogue rows and shopper cards still require the owner's rendered review.

Supplied screenshots inspected:

- `/private/tmp/claude-501/-Users-harry-projects-FireworkEntertAInment/3bfa20cf-9924-4f32-a470-70a7ccc17d85/scratchpad/cmp-ours.png`
- `/private/tmp/claude-501/-Users-harry-projects-FireworkEntertAInment/3bfa20cf-9924-4f32-a470-70a7ccc17d85/scratchpad/cmp-proto.png`

Headless commands: `node /private/tmp/sc-render.mjs`,
`node /private/tmp/sc-hydrate.mjs` and
`node /private/tmp/sc-hydrate-charts.mjs`, with Node 24 first on PATH.
The first temporary harness attempts needed Next's `.js` import resolution and
DOM globals. A static-markup hydration attempt also produced a harness-only text
mismatch; using React's `renderToString` preserved its hydration markers.
The first built-CSS probe expected `--radius-xl` to be emitted; Tailwind inlined
that alias. Checking the generated `.rounded-xl` rule confirmed the 12 px radius.

Temporary verification artefacts: `/private/tmp/sc-render.mjs`,
`/private/tmp/sc-hydrate.mjs`, `/private/tmp/sc-hydrate-charts.mjs`,
`/private/tmp/sc-gallery.html` and `/private/tmp/sc-*.log`.
Happy DOM was installed only under `/private/tmp/sc-dom`; no repository dependency
or lockfile changed. The first temporary npm install failed on the default cache's
permissions; retrying with `/private/tmp/sc-npm-cache` succeeded.

## COMMIT PLAN

Composer-managed commits, in dependency order. PR names below identify ownership
areas, not newly created PRs. No commits, pushes or Git history changes were made.

1. **PR: Theme tokens**. `fix(ui): apply Geist and align prototype typography`.
   Include `app/layout.tsx`, `app/globals.css`, `ui/theme.css`. Owns font application,
   type scale, radii and shared sizing tokens.
2. **PR: Component kit**. `fix(ui): match prototype control and card density`.
   Include `ui/primitives/{button,input}.tsx`, changed `ui/kit/*`, and the common
   gallery `example.tsx`. Owns controls, rows, cards, gallery documentation and
   mobile tile/label constraints.
3. **PR: Component kit and charts**. `fix(ui): preserve chart colour tokens during hydration`.
   Include `ui/charts/chart-theme.ts` and `ui/charts/heatmap-chart.tsx`.
   Owns undefined palette references and static heatmap SVG cells.
4. **PR: Workspace shell**. `fix(ui): align sidebar density with prototype`.
   Include `ui/shell/shell.css` and this review record. Owns sidebar density and
   breadcrumb wrapping. No new lint exceptions or protected-file changes.
