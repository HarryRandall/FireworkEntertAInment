# Finale 3D exports

Show firing scripts retain Finale's fixed 29-column header and one row per cue.
Product ID comes only from `catalogue_items.finale_product_id`. A null mapping
exports a blank ID and the firing note `No Finale 3D equivalent`. Effect Name uses
`finale_effect_name` when present, otherwise the catalogue name. The download
button shows the unmatched cue count and unique exported effect names before
asking the user to continue.

A multishot is exported as one purchased catalogue product. Its own mapping
determines whether the cue is matched, regardless of the child fireworks' mappings.
Administrators can edit these fields in the catalogue metadata dialog and use
Unmatched in Finale to filter products. Its count includes the full catalogue,
read in bounded pages rather than truncated at the API row limit.

## Exact cake syntax

The multishot editor exports an inventory CSV with identical `description` and
`vdl` cells. Letter bindings identify fireworks. Tubes are ordered by elapsed
firing time, then `sequence_index` for simultaneous shots. Seconds convert once to
integer milliseconds. Each tube encodes a signed whole-degree angle, its binding
letter and the outgoing millisecond gap. Omitted angles and gaps carry forward;
the initial omitted gap is 500 ms. The sequence ends with `/CAK`.

Only single-break shell designs are eligible. The first tube must fire at 0 ms.
Effect names containing `+`, parentheses, line breaks or the word `Cake` cannot be
represented. Unknown, ambiguous and ineligible names remain visible in the import
preview and prevent saving.

The syntax has one angle. It represents horizontal `pan_degrees`; imported tubes
have `tilt_degrees = 0`. Export refuses non-zero depth tilt. Finale's syntax parser
accepts angles up to 90 degrees, but saving retains the existing database limit
of 30 degrees of pan. Imports above that limit are previewed and refused without
clamping. Persisted composition limits remain 2,000 shots and 3,600 seconds.

Import replaces the current shots, including from an empty composition. It first
flushes queued shot saves and retains unsaved metadata by requiring those edits
to be saved before opening import. Catalogue matches are resolved again on the
server. `save_multishot_composition` checks the administrator permission and
preview revision, then replaces shots in one transaction through the existing
timing, catalogue and preview triggers. Each tube receives its own editor track;
exact syntax does not contain rack or track positions.

The save records complete before/after shot snapshots in
`multishot_composition_versions`. Import history displays the five latest saved
imports. Failed saves roll back shots, derived state and history together.
History records imports; ordinary individual shot edits retain their existing
save behaviour.

## Database verification

The composition RPC and history table require migration
`20261006000700_multishot_composition_import.sql`. Its pgTAP coverage is in
`supabase/tests/multishot_composition_import.sql`. Apply and test it only in an
available isolated database. The additive TypeScript RPC/table contract in
`apps/web/lib/finale/database.ts` keeps generated database types unchanged until
the migration is applied and `pnpm db:types` can regenerate them.
