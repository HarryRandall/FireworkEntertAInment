# Architecture

ShowCrafter is a Next.js application backed by Supabase. Browser, server, public and
service-role clients are separate typed boundaries. A client choice is part of the
authorisation design, not a convenience.

## Areas and routes

The route map has four areas:

| Area     | Responsibility                                                             |
| -------- | -------------------------------------------------------------------------- |
| Shopper  | QR resolution, store and product viewing, planning, lists and music        |
| Retailer | Organisation setup, range, stock, shows, QR, labels, insights and settings |
| Supplier | Product, price-list and video submissions                                  |
| Admin    | Catalogue, Studio, review, billing, platform settings and integrations     |

Route-owned components belong below their route. Shared domain features live in
`apps/web/ui/<domain>`. Keep rendering, planning and database contracts in their
own packages or services rather than duplicating them in pages.

## UI system

Use shadcn-compatible registry components, including ReUI where suitable, before
building a bespoke table, filter or control. Shared colours and spacing use the
theme tokens in `apps/web/ui/theme.css`, exposed through Tailwind in
`app/globals.css`. The palette, corner radii and shadows match the redesign's
`shared.css`; Geist and Geist Mono are self-hosted through `next/font`. Viewer
surfaces use `bg-stage` and `text-stage-foreground` to retain a cinematic dark
backdrop in either page theme.

Tables use the ReUI Data Grid adaptation in `ui/kit`; charts use the Nivo wrappers
in `ui/charts`. Pages never import Nivo directly. The dashboard filter bar owns no
backend access: consumers control facets, date ranges, sharing and exports. See the
[dashboard kit](ui/dashboard-kit.md) for inputs, provenance and review boundaries.

The shared next-themes provider sets a `.light` or `.dark` class on the document
root. It supports light, dark and system preferences, defaults to system and
retains the browser's `theme` storage key. Use Tailwind's `dark:` variant for
class-based styling. Each page has one main landmark, a useful heading, keyboard
access, visible focus and honest loading, empty and failure states.

All workspace areas use one config-driven workspace shell. A route supplies its
navigation and context through configuration; it does not introduce another shell.

## Renderer and data

`packages/fireworks` owns the renderer and its design JSON Schema. The schema is
