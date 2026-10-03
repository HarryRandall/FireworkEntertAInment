# Admin catalogue

The existing admin shell exposes Effects at `/admin/catalogue`, Products at
`/admin/products`, a cake-only view at `/admin/multishots`, and Suppliers at
`/admin/suppliers`. Lists use the shared ReUI DataGrid, labelled search and metadata
filters, local sorting, column visibility and pagination. RLS reads are paginated
at the transport boundary so a PostgREST row limit does not truncate the catalogue.

Effects and products have UUID detail routes. Saved versions appear newest first,
with status, timestamps, change notes and stills. Used-in regions follow current
product bindings, enclosing selection packs and current show versions. Show names
are readable without inventing a show editor destination. Selection-pack details
show their contents; packs have no composition version history.

The ordinary server client reads under the signed-in staff identity. Server actions
validate input and recheck catalogue editor or super-admin rights. Read-only staff
can inspect records. Duplicate, publish and archive use transactional RPCs. Archive
requires a confirmation and displays dependency refusals. Failed reads remain errors
with retry controls; failed mutations keep the detail page and explain the failure.

Duplication prefers an existing draft, otherwise the current published version. It
creates an independent draft with a unique slug and a name ending in ' copy'. Product
bindings and pack contents are copied atomically. Published status, source history
and safety confirmation are not inherited. Publication uses the existing safety and
composition gates, including the pack publication RPC.

Thumbnails use `poster()` and its serial shared WebGL surface. Product tubes resolve
current published effects, falling back to a draft for unpublished effects. Tube
clocks convert milliseconds to seconds; angles add to authored launch lean, and box
positions convert millimetres to centred world metres. No live viewer is allocated
per row. Object URLs are revoked when a preview is replaced or unmounted; pending
and rendering failures remain visible. Still generation does not upload posters.

`tests/browser/catalogue.spec.ts` covers authenticated lists, sorting, filtering,
details, history, duplicate, publication, archive confirmation and dependency refusal,
plus non-admin refusal. It captures desktop and 390 px light/dark catalogue grids and
per-detail regions under `output/playwright/catalogue-*.png`, checks axe and page
width, and waits for hydration or actual UI conditions. These are expected output
paths, not screenshots produced in the restricted implementation sandbox. The
composer runs the browser suite and captures the matching `admin.html` prototype.

The supplied seed contains four composed single/ground products and 99 effects.
The cake-only list is empty until a cake is created. The grid supports that empty
state. Studio links use `/admin/studio/[effectId]`; the Studio implementation is outside
this catalogue surface. Suppliers are listed without adding their management pages,
imports, review queues or fabricated performance statistics.
