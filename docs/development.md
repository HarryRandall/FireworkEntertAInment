# Development

Use Node 24 and the pinned pnpm version from the repository root:

```bash
eval "$(fnm env)" && fnm use 24
corepack enable
pnpm install --frozen-lockfile
```

## Local services

Supabase is local-only until switch-over. Start a clean local environment with:

```bash
pnpm db:setup
pnpm db:test
pnpm dev
```

Keep secrets in ignored local environment files. Do not link a hosted project or
apply a schema change outside the eventual switch-over runbook.

The shared Python queue runtime is in `services/worker-common`; the Modal
registration layout is in `services/workers/modal_app.py`. Feature services supply
handlers rather than creating separate leases or callbacks. A web check does not
deploy a worker, change hosted Supabase or verify production.

## Checks

Run focused behaviour or SQL tests while changing code, then run:

```bash
pnpm check
```

From the database foundations stage onwards, also run `pnpm db:reset && pnpm db:test`
against local Supabase. For UI work, inspect the requested desktop and narrow layouts
in light and dark themes and attach the screenshots to the PR.

## Renderer review

`http://localhost:3000/dev/fireworks` needs no local Supabase. It shows all built-in
templates and three simulation fixtures as progressive posters produced by one shared,
detached WebGL context. Selecting a card plays it in the independent live context.
After `pnpm db:setup` and `pnpm db:env`, choose a template and use
"Load selected template from database" to render its published stored version.
Fixtures are not database templates. Configuration, missing-row and validation
failures appear beside the loader.
Readiness does not wait for the poster catalogue; PNG work yields to pending live draws. The comparison link opens
`http://localhost:8765/fireworks.html` in a separate tab so the owner can arrange the
two pages alongside each other. The prototype must already be served from the
read-only reference checkout.

The view uses three.js 0.184.0 and a single output target and pass. Add `?ldr` to the
review URL to exercise its 8-bit fallback. Poster cameras frame shell bursts tightly and retain the climb for other kinds. Each
poster samples its own developed moment. The live audience camera and transport stay
independent from thumbnail rendering.

Install the test browser once with `pnpm exec playwright install chromium`.
`pnpm test:browser` runs Chromium journeys, accessibility checks, exact seek replay
and representative template screenshots at desktop and 390 px widths in both
colour schemes. It is included in `pnpm check`. Screenshots stay in ignored
`output/playwright/`; they are review evidence, not approved visual baselines.
Software GL measurements do not establish performance on a real device. The owner
must review visual parity against the prototype before delivery is called verified.

## Spray parity and frame-time comparison

The live view defaults to GPU sprays. Source-clock slots, birth positions, birth opacity
and inherited source velocity remain on the CPU. The vertex shader computes spark
motion, forks, glitter, cooling and streaks. The DOM-free CPU kernel remains the
reference. Both kernels use the same named tuning values and hash stream selectors;
the direction lookup retains the prototype's Float32 quantisation. Integer hash inputs
are uploaded as two exact 16-bit limbs so large seeds cannot round or become NaNs.

`tests/browser/spray-parity.spec.ts` reads the live shader with WebGL2 transform
feedback and compares position, colour, size and alpha with the CPU at fixed times.
The test states Float32/GLSL precision tolerances and covers directed gerbs, glitter,
forks, inherited velocity, streak bounds, large seeds and direct-seek replay.
Each fixed instant samples at most 128 evenly spaced source sparks, retaining all
candidate fork/streak rows for each selected spark. Two source passes count and then
sample the deterministic birth stream. Explicit modifier cases retain every synthetic
birth and boundary age. All populated Float32 texture rows and candidate pairs are
encoded once per case; the shader is compiled once and each instant is replayed on
that context. One comparison pass reports the worst lane using the unchanged
precision tolerances. No float render target is required for this parity harness.

Time the same CPU builder, packing, payload encoding and comparison without Chromium:
`node --import ./scripts/register-typescript.mjs --test packages/fireworks/tests/spray-parity-harness.test.mjs`.
The logged simulation duration includes CPU expectation evaluation and birth packing;
their separate durations are subsets. Node timings exclude page transfer, shader
compilation and software GL, which the composer must verify in the browser gate.

Run `corepack pnpm test:browser` to typecheck and execute it, or
`corepack pnpm exec tsc -p tests/browser/tsconfig.json` to typecheck without launching
Chromium. Full `pnpm check` includes the browser execution and needs Chromium.

On your own machine, open `/dev/fireworks`, select **Run 40-shot finale**, and compare
**CPU sprays** with **GPU sprays**. Restart each path from time zero using the same
viewport, browser, build and foreground visibility. Record median and 95th-percentile
frame intervals during the dense finale and note your device, build mode and viewport.
Repeat each run to distinguish persistent lag from first-use shader compilation.
The rolling readout covers the last 120 visible playing frames, uses a nearest-rank
95th percentile and resets when the scene or path changes. Pause and off-screen gaps
are excluded. The separate smoothed CPU build/submission duration does not measure
GPU completion; frame intervals include browser scheduling and display cadence.
Candidate counts include invisible GPU rows and are not a CPU/GPU visual count comparison.
Browser automation throttles animation frames, so its timings do not prove an improvement
on the owner's machine. Attach desktop and 390 px screenshots in both themes alongside
the prototype, and obtain owner visual review before accepting renderer parity.

## Agent tooling

Project skills are maintained once under `.agents/skills`. Claude uses relative links
from `.claude/skills`; the composer creates and verifies those links because agent
configuration is protected from workspace edits.

The project `.mcp.json` pins the Playwright MCP used for local visual reviews. It runs
an isolated Chromium profile, accepts only the local app and prototype origins, and
writes temporary output outside the repository. These settings reduce accidental
cross-project access but are not a security boundary. Use synthetic local data and
keep production sessions out of the profile.

The adjacent `supabase-local` entry uses the CLI-provided HTTP MCP endpoint at
`http://127.0.0.1:55421/mcp?read_only=true&features=database`. The server version
follows the pinned Supabase CLI (`2.101.0`) and its local image. No hosted project,
access token or cloud MCP endpoint is configured. See the
[official MCP configuration](https://supabase.com/docs/guides/ai-tools/mcp).

The composer starts local Supabase, confirms `pnpm db:status` identifies this project's
API on port 55421, and verifies the MCP connection before inspection. Check the tool
list and a read-only identity query (`select current_database(), current_user,
current_setting('transaction_read_only')`). Confirm the server honours read-only
mode and does not expose migration writes before using it. MCP connectivity and
read-only enforcement have not yet been verified here. If the pinned local server
cannot enforce this setting, leave the connection unused and report it; use the local
CLI for inspection. Schema changes always go through SQL files and the migration
workflow. MCP inspection is elevated local evidence and does not establish RLS
correctness for an API persona.

Read documentation shipped with installed packages first. Use matching official docs
when installed docs are absent, and Context7 only for an unresolved version-specific
library question. Never send credentials, personal data or private source in a
documentation query.

| Tool           | Pinned source                              | Licence    | Purpose                                    |
| -------------- | ------------------------------------------ | ---------- | ------------------------------------------ |
| Playwright MCP | `@playwright/mcp@0.0.83`                   | Apache-2.0 | Local screenshots and browser interactions |
| Supabase MCP   | Supabase CLI `2.101.0` local HTTP endpoint | Apache-2.0 | Local read-only database inspection        |

## Readability lint

Each handwritten TypeScript workspace composes the shared policy in
`scripts/eslint/readability.mjs`. The policy includes type-checked TypeScript rules,
TSDoc syntax, complexity and size limits, numeric-literal checks, selected SonarJS
checks and local rules for export documentation and lint exceptions.

All handwritten TypeScript packages pass these rules without a lint baseline.
Registry primitives are exempt only from export purpose comments so they can stay
close to upstream. Allocation-sensitive numeric kernels retain narrow, explained
parameter-count exceptions; size, complexity and numeric checks still apply.

## Browser posters

Import `poster`, `posterAll`, `developedTime` and `disposePosters` from
`@showcrafter/fireworks/poster` (also re-exported from `/view`).
`await poster(canvas, design, options)` copies a PNG into a 2D canvas and returns its
Blob for uploading. Pass `null` as the canvas to request only the Blob. The stored v1
design must already be validated. Options include sequence `shots`, sequence time `t`
in seconds, `prop`, positive CSS-pixel `width`/`height`, `forceLdr` and a world-metre
`framing: { position, target }` override. Default time is the first shot's firing time
plus its developed moment. The design's stored seed is used unless a shot overrides it.

`await posterAll(root, options)` fills `canvas[data-poster]` elements whose attribute
names a built-in template, in DOM order. Unknown keys and encoding failures reject.
The public API serialises captures and waits for PNG encoding before reusing its one
detached renderer. Size changes affect only this surface. Call `await disposePosters()`
when finished to release the context after queued encoders; the next capture allocates
lazily. The review page owns and revokes its progressive blob URLs on teardown.

Snapshot generation, perceptual tolerances and approval instructions are in
[the poster snapshot guide](../packages/fireworks/tests/snapshots/README.md).
The browser tests are part of `pnpm check`; the full catalogue also has a nightly
workflow. Browser execution and approved baseline images are required before this gate
can pass. Typechecking alone does not verify pixels, readiness time or device performance.

## Seeded local accounts

`pnpm db:setup` resets and seeds the local database. Run `pnpm db:env` once to
create the web app's local environment file; it refuses to replace an existing file.
These synthetic accounts are provisioned only by the local reset workflow. Never
apply the persona seed to a hosted database or reuse its password elsewhere.

All email accounts use the password `LocalShowcrafter123!`:

| Email                          | Persona                  | Access                                                            |
| ------------------------------ | ------------------------ | ----------------------------------------------------------------- |
| `admin@showcrafter.test`       | Platform super admin     | All local tenants; MFA requirement disabled for the local fixture |
| `owner@showcrafter.test`       | Hartley owner            | Leeds and York                                                    |
| `manager@showcrafter.test`     | Hartley manager          | Leeds only                                                        |
| `supplier@showcrafter.test`    | Supplier owner           | Demo Fireworks Supplier                                           |
| `other-owner@showcrafter.test` | Other organisation owner | Other Demo Store                                                  |
| `shopper@showcrafter.test`     | Signed-in shopper        | Own profile; no retailer membership                               |

An anonymous shopper profile is also seeded without an email or password. The
actual shopper flow uses Supabase anonymous sign-in to establish a session.
Use Auth directly for now; the application sign-in screens are not included here.

Demo QR slugs are `hartley-leeds` (store), `hartley-york` (planner),
`hartley-family` (show) and `hartley-garden` (collection). The demo has four
published products, movement-derived stock at both Hartley stores, two live shows,
a manual collection and 340 opening credits. Example legal and safety rules are
unchecked test data, never confirmed legal or supplier advice.

Refresh generated assets with `pnpm db:seeds`, `pnpm db:validators` and
`pnpm db:types`. Each supports `--check`; types compare against the local schema.
The database CI job checks all three after a fresh reset. Design Zod remains
owned and generated by the renderer package's `generate:schema` command.

## Shared Python workers

Install the shared runtime and its pinned check/Modal dependencies in an ignored
virtualenv inside this worktree. CI uses Python 3.11.15; the runtime supports Python
3.11 and newer. From the repository root:

```bash
python3 -m venv services/worker-common/.venv
services/worker-common/.venv/bin/python -m pip install -r services/worker-common/requirements.txt -r services/workers/requirements.txt -e services/worker-common
pnpm test:workers
pnpm db:setup
pnpm test:workers:local
```

`test:workers` runs Ruff lint/format and Python behaviour tests, including offline
registration against the pinned Modal SDK. It is included in `pnpm check`.
`test:workers:local` obtains credentials internally from local Supabase status,
refuses any API other than `http://127.0.0.1:55421`, inserts uniquely identified
`worker_smoke_test` jobs, runs a separate Python CLI process, checks the stored
results and deletes only its own jobs. Run it without another diagnostic worker
claiming that kind. CI runs it in the existing database job after reset and pgTAP.
It checks completion, heartbeat extension, stale/expired attempts, backoff,
exhaustion, cost and duration. SQL tests also execute every installed cron command
against the seeded catalogue and verify expiry, UTC rollups and idempotent reruns.
They roll back all test mutations. This is direct invocation evidence, not proof of
cron firing on its wall-clock schedule.

For a manually queued local diagnostic job, set `SUPABASE_URL` to the exact local
API and `SUPABASE_SERVICE_ROLE_KEY` to its local service-role key in an ignored
environment file or private shell environment, then run:

```bash
services/worker-common/.venv/bin/python -m showcrafter_workers --max-jobs 1
```

This CLI accepts only the diagnostic kind and local target. The diagnostic payload
is `{ "message": "local diagnostic" }`; its result echoes that message. An empty
queue exits immediately. The diagnostic handler is never registered on Modal.
Feature services can run locally using `JobClient(Settings.from_environment(local_only=True))`
and `drain(client, handlers, worker_identity)` with their own registered handlers.

### Queue and handler contract

The database owns the five-minute lease, attempt counter, retry budget and backoff.
The client uses `claim_job`, `renew_job_lease`, `complete_job` and `fail_job`, carrying
`id`, `worker` and `attempt` on every lease mutation. Renewal checks ownership before
the handler begins and every 60 seconds while it runs. Requests have a 20-second
transport deadline; redirects and automatic mutation retries are disabled. A lease
or transport failure stays visible, stops terminal writes and aborts the drain.
There is no ambiguous-error fallback to an empty queue. A failed completion is not
followed by a failure mutation because completion may already have committed.

Handlers receive `(job, usage)` and return a JSON object. They must validate their
feature payload, make any result writes idempotent and respect attempt ownership.
A heartbeat thread cannot forcibly interrupt a synchronous handler: avoid external
side effects after lost ownership and fence feature writes where needed. Handler
exceptions are recorded by class only, because messages may contain credentials,
URLs or user data. Structured stdout logs contain UTC time and queue identity,
never payloads, result documents, service keys or exception messages.

Set `usage.provider_usd` to actual provider spend as calls occur, including spend
before failure. Set `usage.compute_usd` only when a measured infrastructure charge
is available. `jobs.cost` stores `provider_usd`, `compute_usd`, `duration_seconds`
and `scope: "attempt"` through the terminal RPC. Duration is monotonic elapsed
seconds from invocation start, including renewal and handler failure; it excludes
the terminal RPC itself. Provider spend defaults to zero when no calls occur;
unknown compute cost is null, never a guessed tariff. The existing SQL RPC replaces
cost on each finish, so this is the latest finished attempt, not cumulative billing.
Abrupt process death, lease loss or an uncertain terminal request cannot reliably
record a final cost. Reconciliation of actual Modal charges is not implemented.

### Modal layout and wake hook

`create_worker_app(name, handlers, image=...)` returns an SDK app with two functions:
`drain_jobs` and a POST `wake` endpoint. Feature services supply an allowlisted
handler map such as `music_analyse` or `video_analyse`, add their source modules and
pinned dependencies to the supplied image, and expose the returned app from their
own module. The shared package is added to the image automatically. The default is
a Python 3.11 Debian image. No feature handlers are registered by this layout alone.
The existing music analyser deployment is unchanged.

The wake endpoint requires Modal proxy authentication and accepts no job kinds,
payloads or Supabase credentials. It asynchronously spawns a drain and returns its
`call_id`; acknowledgement does not imply job completion. Only the drain receives
the Modal secret named `showcrafter-workers`:

| Setting                     | Location                    | Purpose                                         |
| --------------------------- | --------------------------- | ----------------------------------------------- |
| `SUPABASE_URL`              | Worker Modal secret         | Trusted backend database API origin             |
| `SUPABASE_SERVICE_ROLE_KEY` | Worker Modal secret         | Server-only queue RPC and feature result access |
| `Modal-Key`, `Modal-Secret` | Trusted enqueue dispatcher  | Modal proxy-auth token headers for POST `wake`  |
| Feature provider keys       | Feature-owned Modal secrets | Only keys the registered handlers require       |

Choose **enqueue-triggered authenticated HTTP wakes**, rather than a continuously
polling container. Both functions have zero minimum/buffer containers and a
2-second idle scale-down window. Drains process at most ten attempts with two
concurrent containers and a 1,800-second invocation timeout. These are bounded
operational defaults, not measured capacity or cost guarantees. SQL fencing still
protects overlapping wake calls. Modal function retries are disabled for drains;
job retry state remains solely in Postgres.

The application enqueue integration is a documented hook, not installed here:
a trusted server-side dispatcher must POST to the relevant endpoint after the
queue transaction commits, retain/retry unsuccessful wake delivery, issue enough
wakes for queues larger than a batch, and arrange another wake at `run_after` for
delayed/failed jobs or at lease expiry after a crash. It must not keep an idle
container alive. The endpoint is ready for that dispatcher; no app enqueue code,
`pg_net` trigger, outbox or periodic Modal reconcile schedule is added. Until that
hook exists, use explicit local drains. SQL cron rollups and cleanups remain on
`pg_cron` and do not depend on Modal.

No Modal app, secret or proxy token is created by import, tests or local acceptance.
Deployment, live proxy-auth behaviour, container scale-to-zero, provider/compute
billing and the complete app-to-worker loop require separate owner-run verification.
During the rebuild use local Supabase only; do not configure a hosted secret or
deploy this layout.
