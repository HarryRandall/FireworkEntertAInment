# Local Analyser Runner

The analyser runs automatically after a show is created with uploaded audio.
There is no user-facing "run analysis" action.

## Runtime

- The Next.js server action in `app/(app)/shows/new/actions.ts` creates the show.
- If the show has audio, it schedules `runShowAnalysisForShow` with `after`.
- `runShowAnalysisForShow` runs on the server, downloads the Supabase Storage
  audio object, writes it to a temporary directory, and spawns Python.
- The Python entry point is `platform/analyser/showcrafter.py`.
- The preferred interpreter is `platform/analyser/.venv/bin/python`; if that is
  missing, the runner falls back to `python3`.
- Temporary audio and the scratch Markdown report are deleted after the run.

This does not run in the browser. The client only refreshes the show page while
the server-side job is queued or running.

## Persistence

The database stores a single AI-ready Markdown context in
`show_analyses.markdown`. The context includes the show brief, song summary,
style direction, musical sections, primary anchors, build-ups, and timing
samples.

`analysis_json` and `llm_payload` are deliberately left `null`. The Python
script prints its structured result to stdout with `--no-json-file`, so no JSON
or LLM payload files are written by the server runner.

## Manual Route

`POST /api/analyse` remains as a thin authenticated wrapper around the same
server runner for development and repair use. The product flow does not expose
it as a button.

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

The response contains:

- `analysisId`
- `contextMarkdown`

## Failure Modes

- `400` when the request is invalid or the show has no uploaded audio.
- `401` when the user is not signed in.
- `422` when Python rejects or cannot decode the audio.
- `500` when server setup, storage, or persistence fails.

## Production Notes

- Supabase environment variables must be configured in the server environment.
- The `show_analyses` migrations must be applied.
- The Python dependencies from `platform/analyser/requirements.txt` must be
  available wherever the Next.js server runs.
- Production hosting must allow spawning Python, temporary filesystem writes,
  and enough execution time for audio analysis.
