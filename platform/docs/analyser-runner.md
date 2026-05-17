# Local Analyser Runner

`POST /api/analyze` runs the Python ShowCrafter analyser for an existing show
that already has `shows.audio_path` set by the `/shows/new` upload flow.

## Prerequisites

- Run the Next.js app from `platform/`.
- Configure Supabase environment variables in `platform/.env.local`.
- Apply the `show_analyses` migration before using the endpoint.
- Create the Python analyser virtualenv under `prototypes/audio-analyser/.venv`
  and install `prototypes/audio-analyser/requirements.txt`.
- Upload audio through `/shows/new`; the endpoint does not accept a separate
  upload form.

## Request

```http
POST /api/analyze
Content-Type: application/json
```

```json
{
  "showId": "00000000-0000-0000-0000-000000000000",
  "personality": "balanced"
}
```

`personality` is optional and accepts the analyser presets.

## Response

The endpoint returns:

- `analysisId`
- full analyser JSON
- Markdown report
- compact LLM payload
- persisted `analysisRow` summary for the timeline UI

The full JSON and Markdown are stored inline while they are under 1 MB. Larger
artifacts are stored in the private `audio` bucket under the signed-in user's
prefix, and the row keeps the storage path.

## Failure Modes

- `400` when the show has no uploaded audio or storage cannot return the file.
- `401` when the user is not signed in.
- `404` when the show does not belong to the current user.
- `422` when Python rejects or cannot decode the audio.
- `500` when persistence or server setup fails.

## Cue Generation

The show timeline can turn the latest completed analysis into editable
`show_cues`. The current local bridge is deterministic: it reads the stored
analysis JSON, compact payload, product catalogue, product shots, effect specs,
and available inventory, then maps the strongest music anchors onto suitable
products.

Generated cues are marked with:

- `track = "music-analysis"`
- `layer = "generated"`
- `label = "analysis:<analysis_id>"`
- `locked = false`

Regeneration deletes only previous unlocked cues on the `music-analysis` track.
Manual cues, locked cues, and cues from other tracks are preserved. After the new
generated cues are inserted, the action reindexes all cues for the show by
timeline order so preview, shopping list, show guide, and export flows continue
to consume one ordered `show_cues` set.

If the analyser does not provide explicit firework cue suggestions, key moments,
or build-ups, the planner falls back to high-energy points from
`energy_timeline` so the user can still get a first editable draft.

## Local vs External Blockers

Completed locally:

- Local Python analyser runner using `prototypes/audio-analyser/.venv`.
- Next.js action that generates editable `show_cues` from stored analysis.
- Manual/generated cue coexistence with timeline reindexing.
- Deterministic planner guardrails for product choice, launch positions, budget,
  cue density, and energy fallback.
- Local lint, build, Node tests, and analyser schema validation.

Still needs external or production environment:

- Live Supabase verification against the linked project; the local CLI currently
  needs a project ref/authenticated link.
- Production/Vercel runtime validation for Python packaging, filesystem access,
  and execution time limits.
- Real authenticated end-to-end demo with uploaded music and catalogue data.
- LLM choreography replacement. The current implementation is a deterministic
  adapter, not the final agent-based choreography step.
- Richer generation history if the team wants multiple saved alternatives
  instead of replacing the unlocked generated track.
