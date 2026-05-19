# Local Analyser Runner

`POST /api/analyse` runs the Python ShowCrafter analyser for an existing show
that already has `shows.audio_path` set by the `/shows/new` upload flow.

## Prerequisites

- Run the Next.js app from `platform/`.
- Configure Supabase environment variables in `platform/.env.local`.
- Apply the `show_analyses` migration before using the endpoint.
- Create the Python analyser virtualenv under `platform/analyser/.venv`
  and install `platform/analyser/requirements.txt`.
- Upload audio through `/shows/new`; the endpoint does not accept a separate
  upload form.

## Request

```http
POST /api/analyse
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
artefacts are stored in the private `audio` bucket under the signed-in user's
prefix, and the row keeps the storage path.

## Failure Modes

- `400` when the show has no uploaded audio or storage cannot return the file.
- `401` when the user is not signed in.
- `404` when the show does not belong to the current user.
- `422` when Python rejects or cannot decode the audio.
- `500` when persistence or server setup fails.

## Local vs External Blockers

Completed locally:

- Local Python analyser runner using `platform/analyser/.venv`.
- Storage of analyser JSON, Markdown, and compact numeric AI payloads.
- Timeline UI for song sections, climaxes, build-ups, and technical anchors.
- Local lint, build, Node tests, and analyser schema validation.

Still needs external or production environment:

- Live Supabase verification against the linked project; the local CLI currently
  needs a project ref/authenticated link.
- Production/Vercel runtime validation for Python packaging, filesystem access,
  and execution time limits.
- Real authenticated end-to-end demo with uploaded music and catalogue data.
- LLM choreography that consumes the stored numeric payload and creates editable
  show cues.
