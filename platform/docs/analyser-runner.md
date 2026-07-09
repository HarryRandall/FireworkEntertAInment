# Local Analyser Runner

The analyser runs automatically after the browser uploads a music file in the
new-show wizard. It is separate from show creation and there is no user-facing
"run analysis" action.

## Runtime

- The browser uploads audio directly to the private `audio` storage bucket.
- `startMusicAnalysisAction` creates a `song_analyses` row and schedules
  `runMusicAnalysisForUpload` with `after`.
- `runMusicAnalysisForUpload` runs on the server, downloads the Supabase Storage
  audio object, writes it to a temporary directory, and spawns Python.
- The Python entry point is `platform/analyser/showcrafter.py`.
- The preferred interpreter is `platform/analyser/.venv/bin/python`; if that is
  missing, the runner falls back to `python3`.
- Temporary audio and the scratch Markdown report are deleted after the run.

The analysis does not run in the browser. The client may continue through the
wizard while the server-side job is queued or running.

## Persistence

The database stores rich structured output in `song_analyses.analysis_json`
and a readable Markdown context in `song_analyses.markdown`. The JSON is the
source for cue generation; the Markdown exists for inspection/debugging.

The Python script prints its structured result to stdout with `--no-json-file`,
so no JSON or LLM payload files are written to disk by the server runner.

## Manual Route

`POST /api/analyse` remains as a thin authenticated wrapper around the legacy
show-scoped runner for development and repair use. The product flow uses
upload-scoped `song_analyses` instead and does not expose the API as a button.

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
- The `song_analyses` / show-generation migrations must be applied.
- The Python dependencies from `platform/analyser/requirements.txt` must be
  available wherever the Next.js server runs.
- Production hosting must allow spawning Python, temporary filesystem writes,
  and enough execution time for audio analysis.
