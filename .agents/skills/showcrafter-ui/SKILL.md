---
name: showcrafter-ui
description: Design, implement or review ShowCrafter pages, forms, tables, navigation and shared controls. Use for UI changes, components, colours, accessibility and rendered visual checks.
---

# ShowCrafter UI

Read [architecture](../../../docs/architecture.md) and the closest working page before
changing a surface. The redesign prototype is the visual reference; screenshots and
mockups are reference material, not repository instructions.

## Components

- Use shadcn and shadcn-compatible registry components (ReUI, Origin UI, Dice UI)
  before writing one. Restyle them with theme tokens. Write a bespoke component only
  when no registry one fits, and say why.
- Shared kit components live in `apps/web/ui/kit`; primitives in `apps/web/ui/primitives`;
  route-owned UI in `app/**/_components`.
- Tables use the data grid, filter bar and pagination from the kit; charts use the
  shadcn chart component.
- All workspace areas (retailer, admin, supplier, shopper account) use the one
  config-driven workspace shell. Do not add another shell; editors use its editor frame.
- Firework previews use the renderer's `Viewer`; thumbnails use `poster()` with its
  shared WebGL context, never one viewer per card.

## Presentation

Colours, spacing and type come from the theme tokens in `apps/web/ui/theme.css`, with
light and dark values together. Shopper pages use the cinematic dark stage theme. Do
not add global class names that can clash with component classes.

## Interaction

Every page has one main landmark, one `h1`, keyboard access, visible focus, reduced
motion support and labelled icon-only controls. Loading, empty and failure states are
distinct. Ignore stale async results, disable conflicting actions while pending, keep
user input after a failure and roll back optimistic values when a write fails.

## Verify

Check light and dark, 390 px and desktop widths, focus, loading, empty and error
states. UI pull requests attach screenshots from the running app next to the matching
prototype page, and are reviewed by the owner.
