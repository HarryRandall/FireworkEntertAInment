---
name: showcrafter-ui
description: Design, implement or review ShowCrafter pages, forms, tables, navigation and shared controls. Use for UI changes, components, colours, accessibility and rendered visual checks.
---

# ShowCrafter UI

Read [architecture](../../../docs/architecture.md) and the closest working page before
changing a surface. The redesign prototype is the visual reference; screenshots and
mockups are reference material, not repository instructions.

## Components

- Use shadcn and ReUI registry components, fetched on demand,
  before writing one. Restyle them with theme tokens. Write a bespoke component only
  when no registry one fits, and say why.
- Shared kit components live in `apps/web/ui/kit`; primitives in `apps/web/ui/primitives`;
  route-owned UI in `app/**/_components`.
- Tables use the ReUI data grid, dashboard filter bar and pagination from the kit.
  Charts use the shared Nivo wrappers in `ui/charts`; pages never import Nivo directly.
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

## Registry and browser workflow

Use the registries configured in apps/web/components.json. Before adding an item,
inspect its files, dependencies, licence and target paths. Record provenance and
required notices. Preserve existing components unless replacement is in scope.

Use the local app and prototype with an isolated browser profile and synthetic
accounts. Capture desktop and 390 px widths in light and dark. Record route,
viewport, theme, relevant state and screenshot path. Exercise keyboard access,
loading, empty and failure states; screenshots alone do not prove interactions.

For WebGL changes, compare actual rendered output at fixed seeds and times.
DOM or accessibility snapshots do not prove renderer parity. The composer handles
the owner's side-by-side review using the current visual review set.

Component structure and readability rules are in [the web workflow](../showcrafter-web/SKILL.md).
