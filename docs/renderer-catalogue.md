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
geometry and trail profile beside its template kind, patterns and modifiers. It
also lists every explicit override leaf for all 90 original fireworks. Old
simulation settings have different units, lifetimes and emission models, so
similar controls are not claimed as exact conversions.

The requested family mappings are retained. These differences need particular
attention:

| Old effect     | Template     | Review limitation                                                                |
| -------------- | ------------ | -------------------------------------------------------------------------------- |
| `double_break` | `multiBreak` | Old stars split into fragments; the template has three timed independent breaks. |
| `pearls`       | `pearls`     | Old aerial pearls become a ground-fired sequence of comets.                      |
| `bowtie`       | `bowtie`     | The planar template does not reproduce the old splitting stars.                  |
| `whirl`        | `whirlwind`  | Ring plus spin modifier replaces the old whirl motion.                           |
| `waterfall`    | `waterfall`  | A bottom hemisphere replaces the old wide falling scatter.                       |
| `nishiki`      | `nishiki`    | Brocade-family visual approximation, not a measured reconstruction.              |

`roman_candle` maps to `romanCandle`, `silverFish` to `fish` and
`five_point_star` to `fivePointStar`. The other requested effects map directly.
Nishiki uses 5-second stars, 105 trail sparks, 2.6-second trails and maximum
glitter strength. Brocade uses 3.4-second stars, 70 sparks and 2-second trails.

Main star layers take the primary colour, or an alternate palette when there
are two or more colours. Inner pistils retain template colours; both the planet
and ring of Saturn take the catalogue colours. Comet and candle palettes also adapt. v1
fountains accept only one hex colour: the three original fountains retain their
primary colour and flag the unsupported alternate palettes in the review.
Secondary colours do not have an automatic inner-layer assignment.

Shell heights use the current `height_meters` value. Lift time scales with the
square root of the height ratio. Zero-height shells use the schema minimum of
0.001 seconds. Metallic trails retain their template colours unless an explicit
old trail colour mode overrides them. Such overrides use the old hot colour in
sRGB; the old hot-to-cool behaviour still needs review. Every stored design is
validated with `upgradeDesign`.

## Delivery and invariants

The generated migration fills only null designs and template keys. It matches
existing effects and fireworks by slug, reads current database colours and
heights, and preserves existing designs, keys and catalogue edits. New effects
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
it disposes both viewers and explicitly releases their WebGL contexts. Playback
starts paused, with a shared silent playhead and scrubber. The owner performs the
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
current colour/height adaptation with different UUIDs inside a rolled-back
transaction, then applies the migration twice and compares full-table hashes.
It validates every installed design and compares them with generated bootstrap
designs. PostgreSQL and JavaScript square-root results allow a final-bit
floating-point difference of less than 0.000000000001 seconds. Reset afterwards
to exercise a fresh bootstrap independently.
