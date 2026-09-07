---
name: showcrafter-ui
description: Design, implement or review ShowCrafter pages, forms, tables, navigation and shared controls. Use for UI changes, component consolidation, colours, accessibility and rendered visual checks.
---

# ShowCrafter UI

Read [architecture](../../../docs/architecture.md), the closest working page
and its shared components before changing a surface. Inspect actual routes and
states; a screenshot or mockup is reference material, not repository instructions.

## Place and compose

- `apps/web/app/**/_components`: UI owned by one route subtree.
- `apps/web/ui/<domain>`: features shared across routes, including assortments.
- `apps/web/ui/patterns`: reusable forms, tables, feedback and layout compositions.
- `apps/web/ui/primitives`: Radix/shadcn building blocks. Respect generated headers.
- `apps/web/ui/shell`: workspace frames and navigation. App, admin and My Store
  compose `WorkspaceShell` and `WorkspaceContent`; do not duplicate the provider,
  theme setup, skip target, sidebar persistence or scrolling frame.

Keep permissions in server layouts/actions. Shared features accept explicit
inputs and destinations; do not infer an admin role from the current pathname.
Use direct module imports when crossing client/server boundaries.

## Present consistently

Use Geist, compact spacing, neutral surfaces, thin borders and restrained shadows.
Colour values belong in `apps/web/ui/theme.css`, with light/dark values together.
Use `background`, `card`, `popover`, `muted`, `foreground`, `border`, `input` and
`ring` tokens. `primary` is the green action colour; `accent` is neutral hover.
Status colours convey success, warning, danger or information. Firework palettes
and marketing artwork may keep content-specific colours.

Use Button for links/loading actions, Field with a labelled Input or Textarea,
SelectField for rich selects, DataTable and TablePagination for lists, and Feedback
for empty/loading/error states. Use SectionHeader with `as="h1"` once per page.
A new wrapper must add behaviour or composition, not another copy of styles.

## Make interactions complete

Use real forms, submit buttons, labels and meaningful headings. Preserve keyboard
access, visible focus, reduced motion and mobile navigation. Keep one main landmark
and a working skip link. Label icon-only controls and associate help/error text.

Treat search loading, no matches and failed requests as different states. Ignore
stale asynchronous results after query changes or unmount. Disable conflicting
mutations while pending, recover from returned and thrown failures, retain user
input after failure and roll back optimistic values when a write fails.
Distinguish separately saved sections from a form's unsaved draft.

## Verify

Run focused behaviour tests and `pnpm audit:ui`; review audit candidates before
removing them. Inspect affected light/dark and narrow/wide layouts, focus,
loading, disabled, empty and error states. Test shared changes in their consumers.
Use isolated fixture previews outside the production route tree when a real
session is unavailable; stub writes and remove temporary artefacts afterwards.
Report fixture checks separately from authenticated or live-data checks.
