# Public shopper pages

Public browsing runs outside the workspace shell. The document theme follows the
shopper's system preference or saved theme; the preview stage always stays dark.
Every `/q` and `/shopper` visit establishes an anonymous Auth session through the
session proxy without asking for an account.

## Routes and public contracts

- `/q/[slug]` resolves a permanent code through `resolve_qr`. Store-scoped live codes
  redirect; organisation-wide codes offer only the resolver's authorised stores.
  Retired, paused or unavailable targets show a link back to their known shop.
  Unknown codes cannot infer a shop, so they offer the shopper entry and staff help.
- `/shopper/stores/[slug]` reads `store_page_by_slug`: branding, live collections,
  visible products and retailer shows. A collection QR filters the collection shelves.
- `/shopper/stores/[slug]/products/[id]` reads `product_for_store` for published
  playback, current store price, stock and safety distance.
- `/shopper/stores/[slug]/shows/[id]` reads `show_for_store` for current published
  products, authored cues, quantities, shopping total and availability.
- Store-specific `/plan` and `/list` entries preserve product context and clearly say
  that the action is unavailable. They do not write plans, lists or reserve stock.

The server reads through the cookie-bound typed Supabase client and public RPCs.
Null results are unavailable targets; request or validation failures reach an error
boundary. No service-role client or raw retailer table read is used by these pages.
The new readers retain the existing open-store, active-retailer, published-product,
confirmed-market and matching-currency fences, including `product_markets.allowed`.

## Playback and resource ownership

`lib/shopper/contracts.ts` validates RPC JSON, renderer designs, compositions and
storage references. The playback adapter converts milliseconds to seconds and box
pitch from millimetres to metres. Tube angles are added to authored launch tilt and
bounded by the renderer schema. Manual firing products use the authored fuse delay,
or fire together when no delay is specified. Selection packs play each published
item quantity sequentially using the item's full simulated duration.

Each preview owns one `Viewer`, disposed on unmount. It starts paused at the first
shot's developed moment and requires an explicit Play action. Reduced motion stays
static until that action. Sound is controlled explicitly. Cards use the shared
`poster()` context, not card viewers. Ready stored posters are used only when their
renderer version matches; absent posters are generated in the browser. Blob URLs
and the shared context are released when browsing ends. GPU and image failures stay
visible while product details remain usable.

`recordShopperView` is the named event integration boundary. It dispatches a local
`showcrafter:shopper-view` custom event, with no network request or persisted activity.
A resolved code's `qr` query parameter carries scan identity across the server redirect.

## Verification handover

`tests/browser/shopper.spec.ts` covers all QR target types, organisation store choice,
unknown and retired codes, anonymous cookies, product action context, keyboard
transport, unavailable identifiers, empty ranges and WebGL failure. The 390 px and
1440 px journeys cover store, product and show pages in light and dark, require axe
with no violations and no document overflow, and capture each `data-section`.

Run browser tests through `pnpm test:browser` against the composer's server. The
fixture SQL checks the local endpoint before adding repeatable synthetic selection
pack and QR fixtures. These fixtures are local test data and do not reset the database.
Screenshot paths use `output/playwright/shopper-<surface>-<viewport>-<theme>-<section>.png`.
They are produced only when those browser tests run. Compare them with the read-only
`qr-viewer.html` and `planner.html` prototypes and obtain owner visual review.
