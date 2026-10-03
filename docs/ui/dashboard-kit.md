# Dashboard kit

The shared dashboard components are reviewed at `/dev/components`. The gallery uses
synthetic counts only. It has no database reads, scheduling, public report endpoint
or production data.

## Consumer boundaries

- `ui/kit/data-grid.tsx` accepts typed TanStack columns and records with stable ids.
  Sorting and pagination are local. Selection follows ids across pages. Numeric
  column ids opt into right alignment. Keep selection and actions non-hideable in
  the consumer's columns; put actions last to pin them against the right edge.
- `ui/kit/dashboard-filter.tsx` edits controlled facets, inclusive UTC dates and
  comparison state. The consumer supplies named seasonal/all-time date presets,
  share and export actions. Facets replace one value per named dimension.
- `ui/kit/dashboard-logic.ts` validates view-link input, compares the same calendar
  dates last year and writes quoted CSV with spreadsheet formula protection.
  Leap-day comparisons clamp to 28 February.
- `ui/charts/` owns every Nivo import. Pages use our area, stacked bar, donut, ring,
  heatmap, funnel and sparkline wrappers. The stat card uses the sparkline wrapper.
- `ui/kit/dashboard-pieces.tsx` supplies KPI rows, tabbed breakdown cards and activity
  feeds. Breakdown picks flow through the same controlled facet state as the toolbar.

Charts use theme tokens for grids, text and card tooltips. The area chart uses a
custom Nivo SVG layer for a gradient current series and an unfilled dashed
comparison. Each chart exposes its exact values in an expandable native table,
so keyboard and screen-reader users do not need pointer tooltips. Decorative
sparklines belong to cards that already describe the metric. Reduced-motion
preferences disable chart transitions; sparklines and heatmaps remain static.

The gallery's comparison series is explicitly synthetic, scaled from current counts.
The day-by-hour map and recent activity examples are standalone fixtures, rather than
fabricated filtered historical records. Share creates a link to this local gallery
view and restores validated filters; it does not grant access or publish a report.
CSV export includes only the displayed filtered records.

## Registry provenance

The ReUI Data Grid is fetched on demand from the Radix registry at revision
`c0a29d7675761ed540eb29c0013793855d4e8282`, the TanStack Table v8-compatible source.
The current registry uses TanStack v9 and includes a much larger spreadsheet feature
bundle. The pinned source is adapted to native table rendering, sortable headers,
column visibility, row selection and pagination, using the existing Radix controls.
Resizing, virtualisation, drag-and-drop and spreadsheet editing are not installed.

The full raw registry response and source snapshots are in `docs/vendor/ui/reui/data-grid/`.
`docs/vendor/ui/manifest.json` records the source, immutable revision, content hash,
MIT licence and adapted targets. The existing ReUI MIT notice remains in place.

The filter bar and dashboard layouts compose the already sourced Radix kit. They
have domain-specific controlled state rather than installing another filter registry.
Charts follow the Nivo decision rather than the prototype's ECharts implementation.

## Verification and owner review

Gallery rows use shrinkable grid tracks so wide tables stay within their own
scroll region at phone widths. Grid tables, chart visuals and expanded measurement
tables expose labelled, focusable regions for keyboard scrolling. Column definitions
set `sortDescFirst` explicitly: numeric counts start highest first, text starts
alphabetically. Consumers should preserve that convention when defining columns.

Run the web logic suite, format, lint, typecheck, Knip, package checks and production
build. `tests/browser/components.spec.ts` additionally covers sorting, visibility,
selection across pages, row actions, breakdown chips, date validation, filtered CSV,
shared-view restoration, chart data access and axe with no permitted violations.
Its gallery journey captures each section at desktop and 390 px in light and dark.
Arrow-key tests hold the key for 30 ms to exercise Radix's keyboard timing.

Browser execution, screenshot capture, prototype comparison and owner visual review
must be performed by the composer. No screenshots or accessibility results are
claimed by the sandbox's build and typecheck results.

## Proposed protected skill corrections

The composer should replace these stale lines in
`.agents/skills/showcrafter-ui/SKILL.md`; this document does not apply those edits:

```diff
-- Use shadcn and shadcn-compatible registry components (ReUI, Origin UI, Dice UI)
+- Use shadcn and ReUI registry components, fetched on demand,
   before writing one. Restyle them with theme tokens. Write a bespoke component only
   when no registry one fits, and say why.
-- Tables use the data grid, filter bar and pagination from the kit; charts use the
-  shadcn chart component.
+- Tables use the ReUI data grid, dashboard filter bar and pagination from the kit.
+  Charts use the shared Nivo wrappers in `ui/charts`; pages never import Nivo directly.
```
