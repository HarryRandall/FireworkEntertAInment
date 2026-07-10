# Explore Presets

Explore is curated database content, not a runtime fixture library. Public
pages read published rows from `show_presets`; admins manage the same rows under
`/admin/show-presets`.

## Public Routes

- `/library` lists published presets.
- `/library/[id]` shows one published preset and can clone it into an
  authenticated user's shows.
- `/catalogue` and the two library routes remain available to guests.
- Guests use marketing chrome. Signed-in visitors use `AppShell` without
  changing the public URL.

Do not append code-owned seed arrays when a successful query returns few or no
rows. An empty result is a content state to handle in the UI, not permission to
create a second source of truth. Database and network failures must reach the
browse error boundary and its retry action, not masquerade as an empty shelf or
a missing preset.

## Lifecycle

New, duplicated, and imported presets start with `is_published = false`.
Publication is an explicit admin action. Public queries must always filter to
published rows, while admin queries may show both drafts and published rows.

Import only completed generated shows. Store the source in
`show_presets.source_show_id`, a nullable unique foreign key with `ON DELETE SET
NULL`. Use this ID for idempotency and provenance; do not infer source identity
from mutable titles or slugs. Manually curated presets keep it null. Provenance
is admin-only: omit `source_show_id` from public projections and anonymous
column grants.

## Cue Contract

Each `preview_cues` entry written by current code contains:

```json
{
  "catalogueItemId": "catalogue UUID",
  "catalogueItemSlug": "human-readable-slug",
  "timeSeconds": 12.5,
  "description": "Launch description",
  "launchPositionIndex": 0,
  "emphasis": "normal"
}
```

Treat `catalogueItemId` as the canonical identity. A slug is readable metadata
and a legacy repair hint, not the relational key. Published cue slugs must match
the current catalogue part number so the payload cannot silently drift. Never
drop malformed or unresolved stored cues while mapping them. Keep a visible
repair placeholder in admin, and block save, publication, cloning, and
generated-show import until every source cue is present and resolves to a
current catalogue item.

Before publication or cloning, require all of the following:

- At least one cue.
- A non-negative cue whose full occupancy ends no later than the preset
  duration.
- A valid launch position.
- A non-empty bounded description and a valid `normal`, `accent`, or `peak`
  emphasis.
- A resolved catalogue item and effective occupancy duration for every cue.
- No time overlap between cues on the same launch position.

Use catalogue item duration when checking occupancy. Do not bypass timing
validation in bulk imports, duplication, clone actions, or direct Data API
writes. Postgres must reject an invalid published payload even if a caller
bypasses the server action.

## Likes

`show_preset_likes` stores one row per authenticated user and preset. Users can
read only their own row; insert and delete run through the guarded toggle RPC.
`show_preset_like_counts` stores the public aggregate and exposes no user
identities.

Render these persisted values. Do not derive likes, views, or popularity from a
preset ID, position, featured state, or a seeded constant. Guests may read the
count but must sign in to toggle a like.

Shelf names must describe their real sort or predicate. For example, use Most
liked for lifetime like counts, Recently updated for `updated_at`, and Staff
picks only for featured rows. A See all route reads the full matching set; it
must not reuse a deduplicated or landing-shelf partition. Keep the default
shelves bounded so their client-side cards remain responsive on mobile.

Browse cards prefer the pre-rendered `cover_image_path` poster. Legacy presets
without a poster must render the saved cover's static CSS gradient, never one
WebGL context per card and never a permanently blank skeleton. Admins can
generate faithful stored posters from `/admin/cover-posters`.

## Change Checklist

- Keep database reads as the only runtime source.
- Keep new content draft-first and public reads published-only.
- Write canonical catalogue UUIDs and preserve unresolved cues for repair.
- Validate duration and per-launch-position occupancy.
- Preserve `source_show_id` during imported-preset updates.
- Keep like identities private and aggregates public.
- Keep missing-poster fallbacks CSS-only and retain the admin poster backfill.
- Invalidate `/home`, `/library`, and the affected detail route after a change.
- Update RLS, grants, generated types, and focused tests for schema changes.
