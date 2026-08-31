# Firework import engine validation

The import validator compares source-video frames against frames rendered by the
same `FireworkReplayCanvas` and `FireworksEngine` used by ShowCrafter. It does
not use a Python drawing proxy.

## Protected harness

The harness lives at `/internal/import-render`. It is deliberately outside the
authenticated admin shell because the Modal worker does not have a user
session. Access requires a short-lived HMAC query:

```text
?runId=<uuid>&expires=<unix-seconds>&nonce=<random-base64url>&signature=<base64url-hmac>
```

The signature message is exactly:

```text
showcrafter.import-render.v1
<runId>
<expires>
<nonce>
```

First derive a render-only signing key with
`HMAC-SHA256(key=FIREWORK_IMPORT_SHARED_SECRET,
message=showcrafter.import-render.signing-key.v1)`. Sign the message above with
HMAC-SHA256 using that 32-byte derived key, then encode the final digest as
unpadded base64url. The deployment secret must be at least 32 characters. The
page rejects expired signatures and signatures more than five minutes into the
future. The random nonce prevents capability collisions, but the five-minute
expiry remains the replay boundary.

Only the run ID and short-lived capability appear in the URL. The worker attaches
the browser-normalised source MP4 to the hidden
`[data-testid="import-render-source-video"]` input through Playwright, then
injects each in-memory reconstruction through the page API. Source video bytes,
candidate JSON and Supabase credentials are never included in the URL or page
HTML. The page has a no-referrer, no-index policy, cannot be framed, and uses a
nonce-bearing route-only Content Security Policy.

## Browser contract

Wait for `window.__SHOWCRAFTER_IMPORT_RENDER__`, attach the source file, then
call:

```ts
const result = await window.__SHOWCRAFTER_IMPORT_RENDER__.renderCandidate({
  reconstruction,
  timestampsSeconds,
  includeRenderedFrames: false,
  maxRenderEdge: 960,
});
```

Use between 2 and 180 sorted or unsorted timestamps inside the source duration.
The harness quantises them to the nearest 60 Hz engine boundary, sorts and
de-duplicates them, then reserves any remaining slots to sample through both
the source end and the renderer-estimated lifetime. Frames after the source
ends use a black source target, so an overlong engine fade is penalised rather
than hidden. A uniform sample with extra frames around each observed launch,
burst and fade gives the most useful feedback.

Use metrics-only passes while ranking and refining candidates. PNG output is
opt-in and limited to 48 frames and 16 MB of encoded image data, so run a
smaller second pass for every threshold-passing candidate that can remain
eligible for selection. This keeps large base64 payloads out of repeated
Playwright round trips while preserving the evidence for each publishable
choice.

The call resolves only after the engine is ready and every requested elapsed
time has been rendered. It does not rely on sleeps. The page also emits
`showcrafter:import-render` events with `engine-ready`, `elapsed-rendered`,
`complete`, or `error` detail for diagnostics.

The result contains:

- the FireworksEngine import-renderer contract version used for the capture;
- optional engine PNG frames and particle statistics at quantised sampled timestamps;
- renderer-estimated duration for each canonical design, using the longest pan
  referenced by its shots, and the minimum product duration required by each
  scaled, angled, offset shot;
- timing deltas for onset, peak and fade end;
- normalised screen-space trajectory and spread error;
- a weighted CIE Lab palette distance;
- fade-curve error;
- foreground SSIM, luminance error and chroma error;
- an explicit weighted overall score and field-specific refinement instructions.

Static scene content is removed from both frame sequences before comparison.
Small source-camera translations are registered against the darkest frame, and
the decorative replay starfield is disabled, so lamps, labels and the renderer
backdrop do not become reconstruction targets.

Every engine advance uses integer frame chunks below the replay engine's
large-seek threshold, so requested samples cannot introduce fractional physics
steps. Cues fire after the engine reaches their quantised boundary, then receive
their first physics update on the following frame. The capture uses the replay
camera, world, bloom pass, tone mapping and seeded cue path directly.
Reconstruction shots keep that scheduled boundary in `timeOffsetSeconds` and
retain the raw detected launch in `sourceTimeOffsetSeconds` for audit metadata.

`FIREWORKS_ENGINE_IMPORT_RENDERER_VERSION` is the publication boundary for this
evidence. Its `sha256` suffix is derived from the renderer, replay, mapping and
metric sources listed in `import-renderer-contract.ts`. A test recomputes that
fingerprint, so any source drift must update the application, worker and
database contract before older evidence can be sealed or published.

## Worker persistence

For each candidate, the Modal worker should:

1. Render the candidate before final selection.
2. Append the returned metrics as an immutable `render_metrics` output through
   `append_firework_import_run_output` while its lease is live.
3. For every candidate that meets the engine thresholds, run a bounded PNG
   pass, encode the sampled frames into a review MP4, upload it under a
   run-owned storage path, and pass that path as both the output artefact and
   the candidate's `renderedVideoPath`.
4. Merge the metrics into the candidate row supplied to
   `complete_firework_import_run`.
5. Provide `metrics.priorityIssues` and the component scores to the next critic
   or refinement pass. Raw source frames do not need to leave the worker.

The render result is a mandatory publication gate, but never an automatic
approval. Every component and overall score must meet the configured fidelity
threshold, no priority issue may remain, renderer durations must match the
sealed reconstruction, and the selected candidate's run-owned sampled review
video must still exist. The admin workbench signs this private MP4 only for the
selected candidate and presents it beside the source and a live reconstruction.
It is retained validation evidence, not a continuous render or a claim of exact
physical recovery.
Database schema validation, cue overlap safety and explicit admin approval are
separate requirements.

## Dispatch lifecycle

Production refuses to create or fund a reconstruction run unless the Modal URL,
32-512 character shared secret and trusted Supabase service-role client pass
preflight. Development keeps the lease-aware local poller as an explicit
fallback when direct dispatch is not configured.

The platform claims one direct-dispatch attempt in Postgres, then retries only
transient transport failures and HTTP 408, 425, 429, 500, 502, 503 or 504
responses. Modal acceptance is deliberately strict: the response must be HTTP
202 with an `application/json` body containing the exact requested `runId`,
`status: "accepted"`, and a non-empty `callId` of at most 240 characters.
Authentication failures, a mismatched run ID and malformed acknowledgements are
not retried.

`direct_dispatch_status`, `direct_dispatch_call_id`, attempt count, error and
timestamp describe the platform-to-Modal request. `modal_call_id` is separate:
the worker records it only after acquiring the database lease, so it identifies
the actual executor rather than the container initially spawned by the web
request. If dispatch exhausts its safe retries while the run is still queued, a
service-role-only RPC atomically fails the job and run and refunds the reserved
credits. The RPC locks the job before the run, matching worker claim order. If
an explicit queue sweep or local poller has already claimed the run, dispatch
failure records `worker_claimed` and cannot fail or refund that in-flight work.
The deployed Modal app does not poll automatically. Operators can invoke its
queue sweep explicitly to recover a stranded queued run, while local
development can still use the polling worker.

## Deployment constraints

The worker runtime needs Chromium plus Playwright and network access to the
deployed ShowCrafter origin. Configure the full harness URL as
`FIREWORK_IMPORT_RENDER_URL` in the Modal secret, and configure the identical
`FIREWORK_IMPORT_SHARED_SECRET` in both Vercel and Modal. The worker must derive
the render-only signing key described above and reject any configured harness
URL that is not the expected trusted HTTPS origin. Local development can
point the worker at a reachable development tunnel, but `localhost` inside
Modal refers to the Modal container, not the developer's Mac.

A single two-dimensional video cannot prove the hidden physical depth of a
firework. These metrics verify the rendered camera match and make the remaining
3D assumptions explicit; they must not be described as ground-truth physical
recovery.
