---
name: showcrafter-design-system
description: >-
  REQUIRED for any UI work in the ShowCrafter Next.js app. Use when editing
  app/**, creating pages, components, or styling. Triggers: design, palette,
  hero, button, card, navbar, page, redesign, theme, tokens, Tailwind,
  ShowCrafter brand, fireworks UI, admin UI, shader covers, dark theme,
  loading states, public browse, editor controls, mobile navigation.
---

# ShowCrafter Design System

ShowCrafter is a professional AI firework show-planning platform. The app should
feel like a precise creative tool, a show-control workspace, and a soundtrack
timeline editor. It must not feel like a crypto dashboard, a gaming site, a
cheap neon landing page, or a decorative fireworks poster.

## Source Of Truth

- Global tokens live in `platform/app/globals.css`.
- App UI primitives live in `platform/app/components/ui`.
- The low-level Radix/shadcn layer lives in `platform/components/ui`. Only files
  explicitly marked as generated are non-editable; `sidebar.tsx` is adapted and
  the shader helpers in that directory are custom.
- Shared legacy class fragments live in `platform/app/components/ui/styles.ts`.
- Theme state uses `next-themes` with the `data-theme` attribute and
  `defaultTheme="system"`.
- Use `cn()` from `@/lib/utils`.

Read the local component before copying a pattern. The repo has active local
variants and some generated files are marked "do not edit manually".

## Visual Direction

The current product palette is neutral and shadcn-dashboard aligned:

- Light theme: white and near-white surfaces, thin neutral borders, near-black
  content, restrained system accent.
- Dark theme: black-first surfaces, subtle neutral borders, muted raised fills,
  and sparse contrast.
- Marker green is the sparse brand primary for main actions, focus rings,
  progress, and active technical markers. The `accent` token remains a neutral
  hover or selected surface, not the brand colour.
- Gold, violet, sky, rose, and other show-palette colours belong in covers, cue
  visualisation, simulation, and small semantic highlights, not normal chrome.
- A static rainbow wash is available for marketing atmosphere and small
  highlights. Do not turn normal app/admin surfaces into rainbow cards.
- Avoid warm brown, parchment, burnt orange, ember-led visuals, and one-note
  neon gradients.

Use semantic tokens such as `bg-background`, `bg-card`, `text-foreground`,
`text-muted-foreground`, `border-border`, `bg-primary`, `text-primary-foreground`,
`ring-ring`, and the `--color-*` tokens from `globals.css`. Use `--hl` and its
ink/soft variants for the marker-green brand highlight. Avoid hard-coded colours
except inside Three.js, shader, Canvas, or SVG simulation assets where CSS tokens
cannot be consumed directly.

## Typography

- Use the configured Geist font from `next/font`.
- Use the configured Geist Mono through `font-mono`, plus `tabular-nums`, for
  timings, product codes, prices, quantities, confidence scores, IDs, and dense
  table metadata.
- Avoid decorative fonts and thin low-contrast text.
- Keep text sizes compact inside app panels, admin tables, sidebars, cards, and
  tool surfaces.
- Do not use viewport-based font sizing.

## Component Rules

- Build UI in this order: app primitive, domain-specific component,
  route-level composition.
- Prefer imports from `@/app/components/ui` in product code.
- Use generated `@/components/ui/...` imports only when extending the shadcn
  layer or using primitives not wrapped by app components.
- New repeated app-level patterns belong in `platform/app/components/ui`.
- Buttons are `rounded-md`, have visible focus rings, and should use icon-only
  treatment for obvious compact actions.
- Standard app controls are normally `h-10`; dense admin controls can use `h-8`
  or `h-9`. Use `rounded-md` for controls and `rounded-xl` for normal cards.
- Use lucide icons inside icon buttons when an icon exists.
- Cards use token borders, neutral surfaces, and 8-16px radii. Do not nest
  cards inside cards unless the inner item is a repeated object.
- Keep app and admin screens dense, scannable, and utilitarian.
- Form fields should use `Field`, `FieldLabel`, `FieldHint`, `FieldError`, and
  the local input/select/slider primitives where possible.
- Tables should use semantic table markup, searchable/filterable controls where
  useful, and readable mobile fallbacks.
- Destructive actions need the destructive variant and a clear confirmation
  when the action is hard to undo.
- Describe destructive and password-reset actions by their real backend scope.
  Invoke the actual operation, and never report success for a placeholder.
- Empty states should explain what is missing and provide a recovery action when
  one exists.

## Loading States

Keep stable route chrome visible while data loads:

- Page titles and descriptions.
- Labels and section headings.
- Table headers.
- Form group structure.
- Tabs, breadcrumbs, and navigation.

Use neutral `Skeleton` placeholders for data-driven fields, active values,
counts, badges, preview media, and controls whose value is still loading. Match
loaded height, width, radius, and footer button sizes closely so loading does
not shift layout.

## App Patterns

- Customer workspace chrome belongs in `AppShell`.
- Admin chrome belongs in `AdminShell`.
- Public browse pages (`/catalogue`, `/library`, `/library/[id]`) can be
  available to anonymous visitors. Use marketing chrome for guests and
  `AppShell` for signed-in visitors; avoid auth-only UI assumptions there.
- Keep one main landmark per shell and keep a mobile sidebar trigger visible
  outside a closed sheet.
- Filter admin navigation by each destination's required permission. Continue
  to enforce permission checks in routes and server actions.
- The show wizard must preserve the product boundary: upload starts quiet music
  analysis, Generate creates the show and starts cue generation.
- In `fast` mode, identify the fast planner and hide model selection. In `llm`
  mode, show the selected model and its cost. Revalidate the mode on submit.
- Do not add visible copy that explains hidden background processing unless an
  error blocks the user.

## Explore Patterns

- Render Explore from database-managed `show_presets`; do not append runtime
  seed files.
- Treat new, imported, and duplicated presets as drafts until an admin
  publishes them.
- Render persisted like state and aggregate counts. Do not fabricate likes,
  views, popularity, or social proof.
- Use factual shelf names and build See all from the complete matching set.
  Database failures use a safe retry boundary, not an empty-state message.
- Keep unresolved legacy cues visible in admin for repair. Block save,
  publication, and cloning until every cue has a canonical catalogue UUID and a
  safe launch-position schedule.

## Firework And Editor Patterns

- Firework previews use fixed cinematic canvases in list cards and interactive
  orbit controls on detail/editor views.
- Heavy WebGL, shader, and editor components must not be imported globally.
- Firework, effect, and style-default admin editors share
  `FireworkEditorShell`, compact preview transport controls, history/JSON
  panels, and scoped `FireworkRenderControls`.
- Style-default pages intentionally expose a narrower side rail than the full
  firework/effect editors.
- Timeline, waveform, cue, and emphasis markers should be precise and technical
  rather than decorative.
- AI-generated analysis should include clear confidence/status indicators and an
  "AI-generated content may be incorrect" notice where relevant.
- Include every simulation input and launch-position coordinate in preview
  cache keys so a visual edit invalidates cached frames.
- Preserve edits made during an in-flight save. Apply the returned snapshot
  only when local state still matches the signature captured at save start.
  Keep the latest signature ref current in a layout effect, and treat the
  server-returned canonical values as the saved snapshot.
- Treat version-history recording as best-effort after the primary save. Do not
  refresh a history panel before the deferred write can be observed. Confirm an
  optimistic history ID with a short bounded check before enabling Restore;
  remove it with a history-only warning if recording never confirms.
- Keep speed, life, duration, and other physical ranges non-negative and aligned
  across controls, validation, actions, defaults, and renderer behaviour.
- Label the interactive slider thumb, put the visible label's target ID on that
  focusable thumb, and do not show a history Preview action unless it performs
  a real preview.

## Shader Covers

Shows and presets store a serialisable `cover_shader` JSON identity. Use the
`platform/lib/cover.ts` dispatcher plus the CSS and legacy shader helpers for:

- Random covers at show creation.
- Deterministic covers for seeded templates.
- Parsing and normalising stored cover JSON.
- Backdrop colours and readable fallback palettes.

Do not hand-roll incompatible cover objects in routes. Keep shader controls
bounded and aligned with the dev playground behaviour. Browse cards should use
their pre-rendered poster, with the saved cover's static CSS gradient as the
missing-poster fallback. Never mount one live WebGL cover per card.

## Accessibility

- Normal text targets 4.5:1 contrast; large text targets 3:1 or better.
- Do not rely on colour alone for status; pair status with text or iconography.
- Every interactive control must be keyboard accessible.
- All controls need visible focus states.
- Never remove the browser focus indicator globally. A component may suppress
  its native outline only when that same focusable element has a visible ring or
  equivalent replacement.
- Forms need labels or explicit `aria-label`s.
- Slider thumbs and other interactive primitive parts need their own accessible
  names.
- Tables need semantic markup for dense admin data.
- Text must not overflow its parent at mobile or desktop widths.

## Review Checklist

- Uses tokens rather than one-off colours.
- Uses marker green only for primary actions, focus, progress, and technical
  highlights; neutral `accent` remains a hover or selected surface.
- Works in light, dark, and system theme modes.
- Preserves stable route chrome during loading.
- Keyboard focus is visible.
- Text fits at mobile widths.
- Tables remain readable on mobile.
- Heavy media/WebGL/editor code is not imported globally.
- UI feels like a precise work tool, not a neon landing page.
- No brown, parchment, burnt-orange, or ember palette regressions.
- Show creation still separates upload analysis from explicit generation.
- Generation model and cost UI matches the active fast or LLM mode.
- Explore metrics are persisted data, and draft presets never leak into public
  browse results.
- Admin navigation reflects route permissions, while route checks remain in
  place.
- Editor saves preserve newer edits and preview caches invalidate on every
  simulation input.
