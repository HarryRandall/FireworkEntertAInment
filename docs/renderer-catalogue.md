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

Each original firework resolves its saved `render_snapshot_json`, falling back to
`compileFireworkDesign` with its effect model and overrides. Outer and enabled
inner stars become independent layers with individual counts, spread, lifetime,
variation, heads, colours, trails and modifiers. Calibre uses the old engine's
30 mm baseline and scaling exponents, without changing launch height.

Radius and head size use visual calibration against the peony template: old
speed 3.2 corresponds to 26 metres, and old head size 170 to v1 size 1.1. Gravity
uses mean old gravity with inverted y; old -0.24 corresponds to 9 metres per
second squared. These are approximations between different simulation models,
not measured physical reconstruction. Shape life, gravity, drag and spread
multipliers are retained where v1 exposes a corresponding control.

Layer palettes retain explicit inner/outer colours, secondary colours, random
selection, and opening/closing colour stops. Spatial bands and stripes use
alternating palettes and are flagged. Trail presets retain density, lifetime,
metallic or star colour, flicker and glitter. Strobe, crackle, split, fish and
whirl settings become modifiers; template-only ghost and falling-leaf behaviours
retain their modifiers. Inner stars are not duplicated in burst-core sparks.

The review records unsupported spatial colour masks, sprite shape and width
curves, detailed fragment controls, animated head size, gravity ranges, custom
tracer/smoke colours and ground-kind limits. `double_break` still uses the
multi-break template's three independent breaks; old aerial `pearls` still uses
a ground comet sequence. v1 fountains retain one colour. Nishiki's library
entry retains its denser template, while original Nishiki fireworks use their
own old star and trail settings.

Shell heights use `height_meters` with the existing square-root lift-time
adjustment. Zero-height shells use 0.001 seconds. Other template heights, lift
times, break offsets and ground sequence timing remain intact. Each original
firework has a deterministic seed derived from its slug. Every resulting
design passes `upgradeDesign` validation.

To measure variety, run:

```sh
node scripts/catalogue/variety.mjs /private/tmp/catalogue-variety-before/fireworks.json supabase/bootstrap/fireworks.json
```

It reports full distinct designs, distinct designs excluding seed, and unordered pairs equal after
removing colour controls and seed. The before data is the original conversion
at commit `466b2aae`. Across the 90 fireworks it had 88 distinct designs and
94 pairs equal apart from colour. The updated conversion has 90 distinct
designs (88 excluding seed) and 88 pairs equal apart from colour. Many old
colour-only siblings intentionally retain the same tuning; no extra variation
is invented to inflate this measure.

## Delivery and invariants

The generated migration fills only null designs and template keys. It matches
existing effects and fireworks by slug, adapts generated snapshot designs to
current database colours and heights, and preserves existing designs, keys and catalogue edits. New effects
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
