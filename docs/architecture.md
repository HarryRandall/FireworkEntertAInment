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
theme tokens. Each page has one main landmark, a useful heading, keyboard access,
visible focus and honest loading, empty and failure states.

All workspace areas use one config-driven workspace shell. A route supplies its
navigation and context through configuration; it does not introduce another shell.

## Renderer and data

`packages/fireworks` owns the renderer and its design JSON Schema. The schema is
