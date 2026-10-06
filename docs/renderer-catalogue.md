# Renderer catalogue designs

`pnpm catalogue:designs` builds the catalogue from package templates and the
existing bootstrap records. `pnpm catalogue:designs --check` runs in `pnpm check`
and rejects stale migration, bootstrap, manifest or review files. It does not
connect to a database. Generated library identities use deterministic UUIDs and
`renderer-` slugs. Existing records retain all fields except their new designs
and effect template keys.

The catalogue contains 102 effects and 166 atomic fireworks. The original 26
effects and 90 fireworks receive designs. The remaining 76 templates each add
an effect, default firework and unlisted catalogue item. There are 220 catalogue
items: 181 firework entries and 39 multishots. The 152 new empty preview manifests
bring the total to 307; the existing captured previews and media stay intact.

## Mapping review

[The generated review](../scripts/catalogue/review.json) records every old effect's
geometry and trail profile beside its template kind, patterns and modifiers.

Each original firework matches the first suitable keyword rule in
`scripts/catalogue/designs.mjs`. Compound effects take priority. Names outrank
descriptions, base effects and legacy behaviour hints. Equally suitable template
variants use a deterministic least-used tie break in slug order. The review lists
the chosen key, template name and matching reason for all 90 records.

Designs clone the matched template. Primary colour, palette and secondary colour
replace authored colour identities in main star layers and ground emitters, retaining
stop times, scalar/palette structure, modes and relationships between layers.
Metallic trails and flashes remain authored. No old sizes, counts, halos, droop,
trails or launch tuning are copied. Height bands and climb times come from the
already calibrated template. Each firework has a distinct deterministic seed.
Base effects retain their existing mapped template, independently of product matching.

## Delivery and invariants

The generated migration fills only null designs and template keys. It matches
existing effects and fireworks by slug, adapts matched template colours to
current database colours, and preserves existing designs, keys and catalogue edits. New effects
are inserted only if their key and slug are absent. Fireworks and catalogue
items use their stable slug or part number. A second application makes no row
changes. Empty databases skip content delivery and receive the same content
through bootstrap. Once released, retain migration history and deliver later
content changes in a new migration.

The migration leaves triggers enabled. The firework snapshot trigger receives a
complete valid old-renderer placeholder, while new effect models contain only
the valid old sphere geometry and trail profile. The placeholder is not a
rendering of the new template. The firework and its explicit unlisted catalogue
item are inserted in one statement, before queued AFTER INSERT triggers run.
The automatic catalogue trigger then encounters the existing slug. This avoids
creating a listed placeholder product and does not modify existing products.
Preview triggers create the two empty manifests per template; bootstrap supplies
them explicitly because bootstrap disables user triggers during import.

The timeline and multishot triggers run normally. New library rows have no show,
preset or multishot references. Positive durations come from `shotDuration`;
catalogue durations are rounded to the table's two decimal places. Shell height
is supplied by the design; other heights and all calibres are null rather than
invented product specifications. Required source, confidence, palette, metadata,
timestamps and schema fields are populated, and Finale identifiers stay null.

Catalogue RLS hides unlisted items from anonymous and ordinary authenticated
reads. `listFireworkProducts` also explicitly filters `is_listed = true`, including
admin and service-role reads used by generation, and uses new cache keys.
Existing atomic specification reads remain available to admin component editors
and multishot reconstruction. Public browse cards and generation use catalogue
products. The raw effect/firework table read policies remain unchanged.

## Comparison and local verification

`/admin/renderer-compare` requires catalogue administration permission in addition
to the admin layout boundary. It reads current saved designs and overrides for
the original 90 slugs. Only one comparison pair can be open. Closing or replacing
it disposes both viewers and explicitly releases their WebGL contexts. The new renderer uses the same shared full-width aspect-video viewer as the
preview page, including its built-in player and default camera controls. The old
renderer has independent playback controls. The owner performs the
browser and visual review.

The following checks use only the disposable local stack:

```sh
eval "$(XDG_STATE_HOME=/private/tmp/showcrafter-fnm fnm env --shell zsh)"; fnm use
pnpm db:reset
pnpm db:bootstrap --local
pnpm db:verify --local
node --import ./scripts/renderer/register-typescript.mjs scripts/catalogue/verify-local.mjs
pnpm db:fixtures
pnpm db:test
pnpm db:lint
pnpm check
pnpm --filter @showcrafter/renderer check
```

Retain a copy of the previous bootstrap directory, including its manifest and
media, before generating updated files. After a local reset, replay it with:

```sh
node --import ./scripts/renderer/register-typescript.mjs scripts/catalogue/verify-local.mjs \
  --previous-bootstrap /private/tmp/showcrafter-previous-bootstrap
```

This imports the previous snapshot, checks admin design/key preservation and
current colour substitution with different UUIDs inside a rolled-back
transaction, then applies the migration twice and compares full-table hashes.
It validates every installed design and compares them with generated bootstrap
designs. Template structure is compared against the generated snapshot. Reset afterwards
to exercise a fresh bootstrap independently.
