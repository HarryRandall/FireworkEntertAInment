---
name: showcrafter-design-system
description: REQUIRED for any UI work in the ShowCrafter Next.js app. Use when editing app/**, creating pages, components, or styling. Triggers: design, palette, hero, button, card, navbar, page, redesign, theme, tokens, Tailwind, ShowCrafter brand, fireworks UI, dark theme.
---

# ShowCrafter Design System

ShowCrafter is a professional AI firework show-planning platform. The app should
feel like a cinematic creative AI tool, a show-control workspace, and a precise
soundtrack/timeline editor. It must not feel like a crypto dashboard, a gaming
site, or a cheap neon landing page.

## Visual Direction

Default mode is dark navy/black with restrained neon accents:

- App background: `#05070D`
- Primary surface: `#0B1020`
- Elevated surface: `#11182A`
- Deep panel: `#141B2E`
- Subtle border: `#22304A`
- Strong border: `#31415F`
- Primary text: `#F5F7FA`
- Secondary text: `#AAB6C8`
- Muted text: `#65748B`
- Primary neon cyan: `#00E5FF`
- Electric blue: `#3B82F6`
- Violet: `#8B5CF6`
- Magenta: `#FF3DF2`
- Live/success green: `#00FF9C`
- Wow/highlight yellow: `#FFD166`
- Danger: `#FF4D6D`

Light mode is a first-class production view:

- App background: `#F7F9FC`
- Primary surface: `#FFFFFF`
- Elevated surface: `#F1F5F9`
- Subtle border: `#D8E0EC`
- Strong border: `#B7C3D7`
- Primary text: `#0B1020`
- Secondary text: `#344256`
- Muted text: `#64748B`
- Primary blue: `#006DDB`
- Cyan accent: `#008AA8`
- Violet accent: `#6D28D9`
- Magenta accent: `#BE185D`
- Success: `#008A5B`
- Danger: `#DC2626`

Use tokens from `platform/app/globals.css`; avoid hard-coded colours except
inside WebGL/SVG simulation assets where CSS tokens cannot be consumed directly.

## Typography

- Use Geist Sans via `next/font` for UI and display.
- Use Geist Mono for timings, product codes, prices, quantities, confidence
  scores, and table metadata.
- Use tabular numerals for all durations, timings, prices, counts, and admin
  table values.
- Avoid decorative fonts, thin low-contrast text, and oversized text inside
  compact app panels.

## Component Rules

- Build UI in this order: `components/ui` primitives first,
  domain-specific components second, route-level composition last.
- New UI primitives and shared variants belong in `components/ui`; do not create
  one-off page components when an existing primitive can be composed.
- Prefer imports from `@/app/components/ui` in new code. Direct file imports are
  allowed in existing code, but do not introduce duplicate component wrappers.
- Use `cn()` from `@/lib/cn` for class merging.
- Use `components/ui/styles.ts` for shared class conventions and
  `components/ui/tokens.ts` for code-only colour access.
- Buttons are pill-shaped, 44px+ touch targets, visible focus rings.
- Cards use 12-16px radii, token borders, subtle glassy surfaces, and restrained
  neon shadows only on hover or primary action states.
- Neon cyan/blue/violet are for actions, links, selected nav, live states,
  waveform/timeline accents, and AI/firework tags.
- Yellow is reserved for finale, highlight, and "wow moment" states.
- Do not use warm brown, parchment, burnt orange, or ember-led visuals.
- Do not nest cards inside cards unless the inner item is a repeated object.
- Keep app screens dense, scannable, and utilitarian; this is a working tool.
- Form fields should use the `Field`, `FieldLabel`, `FieldHint`, and
  `FieldError` pattern.
- Loading states should use `Skeleton` shapes that match the loaded content.
- Empty states should include a clear message and an action when recovery is
  available.
- Destructive actions should use the destructive button variant and a clear
  confirmation flow when the action cannot be easily undone.

## Accessibility

- Normal text targets 4.5:1 contrast; large text targets 3:1 or better.
- Do not rely on colour alone for status; pair status with text/iconography.
- Every interactive control must be keyboard accessible.
- All controls need visible focus states.
- Forms need labels or explicit `aria-label`s.
- Tables need semantic `<table>` markup for dense admin data.

## Product-Specific Patterns

- Firework previews use fixed cinematic canvases in list cards and interactive
  orbit controls on detail/editor views.
- Timeline, waveform, cue, and "wow moment" markers should be precise and
  technical rather than decorative.
- AI-generated analysis should include clear confidence/status indicators and
  an "AI-generated content may be incorrect" notice where relevant.

## Review Checklist

- Uses tokens, not one-off colours.
- Works in dark and light modes.
- Keyboard focus is visible.
- Text does not overflow at mobile widths.
- Tables are searchable/filterable where useful and remain readable on mobile.
- Heavy media/WebGL/editor components are not imported globally.
- No brown/burnt/ember palette regressions.
