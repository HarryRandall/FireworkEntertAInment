---
name: showcrafter-design-system
description: >-
  REQUIRED for any UI work in the ShowCrafter Next.js app. Use when editing
  app/**, creating pages, components, or styling. Triggers: design, palette,
  hero, button, card, navbar, page, redesign, theme, tokens, Tailwind,
  ShowCrafter brand, fireworks UI, admin UI, shader covers, dark theme,
  loading states.
---

# ShowCrafter Design System

ShowCrafter is a professional AI firework show-planning platform. The app should
feel like a precise creative tool, a show-control workspace, and a soundtrack
timeline editor. It must not feel like a crypto dashboard, a gaming site, a
cheap neon landing page, or a decorative fireworks poster.

## Source Of Truth

- Global tokens live in `platform/app/globals.css`.
- App UI primitives live in `platform/app/components/ui`.
- Generated Radix/shadcn primitives live in `platform/components/ui`.
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
- Accent colour is neutral by default. Cyan, violet, magenta, yellow, and green
  can appear as tiny semantic or shader highlights, not as the whole interface.
- A static rainbow wash is available for marketing atmosphere and small
  highlights. Do not turn normal app/admin surfaces into rainbow cards.
- Avoid warm brown, parchment, burnt orange, ember-led visuals, and one-note
  neon gradients.

Use semantic tokens such as `bg-background`, `bg-card`, `text-foreground`,
`text-muted-foreground`, `border-border`, `ring-ring`, and the
`--color-*` tokens from `globals.css`. Avoid hard-coded colours except inside
WebGL, shader, or SVG simulation assets where CSS tokens cannot be consumed
directly.

## Typography

- Use the configured Geist font from `next/font`.
- Use `font-mono` and `tabular-nums` for timings, product codes, prices,
  quantities, confidence scores, IDs, and dense table metadata.
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
  available to anonymous visitors; avoid auth-only UI assumptions there.
- The show wizard must preserve the product boundary: upload starts quiet music
  analysis, Generate creates the show and starts cue generation.
- Do not add visible copy that explains hidden background processing unless an
  error blocks the user.

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

## Shader Covers

Shows and presets store a serialisable `cover_shader` JSON identity. Use
`platform/lib/shader-cover.ts` helpers for:

- Random covers at show creation.
- Deterministic covers for seeded templates.
- Parsing and normalising stored cover JSON.
- Backdrop colours and readable fallback palettes.

Do not hand-roll incompatible cover objects in routes. Keep shader controls
bounded and aligned with the dev playground behaviour.

## Accessibility

- Normal text targets 4.5:1 contrast; large text targets 3:1 or better.
- Do not rely on colour alone for status; pair status with text or iconography.
- Every interactive control must be keyboard accessible.
- All controls need visible focus states.
- Forms need labels or explicit `aria-label`s.
- Tables need semantic markup for dense admin data.
- Text must not overflow its parent at mobile or desktop widths.

## Review Checklist

- Uses tokens rather than one-off colours.
- Works in light, dark, and system theme modes.
- Preserves stable route chrome during loading.
- Keyboard focus is visible.
- Text fits at mobile widths.
- Tables remain readable on mobile.
- Heavy media/WebGL/editor code is not imported globally.
- UI feels like a precise work tool, not a neon landing page.
- No brown, parchment, burnt-orange, or ember palette regressions.
- Show creation still separates upload analysis from explicit generation.
