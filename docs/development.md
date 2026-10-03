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

Modal workers are introduced in later rebuild stages. Configure and deploy them only
when their stage defines the worker contract. A web check does not deploy a worker,
change hosted Supabase or verify production.

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
templates and three simulation fixtures as static previews produced by one WebGL
context. Selecting a card plays it in that same context. The comparison link opens
`http://localhost:8765/fireworks.html` in a separate tab so the owner can arrange the
two pages alongside each other. The prototype must already be served from the
read-only reference checkout.

The view uses three.js 0.184.0 and a single output target and pass. Add `?ldr` to the
review URL to exercise its 8-bit fallback. The fixed review camera fits sampled
particle bounds; interactive camera controls and sound are separate concerns.

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

Read documentation shipped with installed packages first. Use matching official docs
when installed docs are absent, and Context7 only for an unresolved version-specific
library question. Never send credentials, personal data or private source in a
documentation query.

| Tool           | Pinned source            | Licence    | Purpose                                    |
| -------------- | ------------------------ | ---------- | ------------------------------------------ |
| Playwright MCP | `@playwright/mcp@0.0.83` | Apache-2.0 | Local screenshots and browser interactions |

## Readability lint

Each handwritten TypeScript workspace composes the shared policy in
`scripts/eslint/readability.mjs`. The policy includes type-checked TypeScript rules,
TSDoc syntax, complexity and size limits, numeric-literal checks, selected SonarJS
checks and local rules for export documentation and lint exceptions.

All handwritten TypeScript packages pass these rules without a lint baseline.
Registry primitives are exempt only from export purpose comments so they can stay
close to upstream. Allocation-sensitive numeric kernels retain narrow, explained
parameter-count exceptions; size, complexity and numeric checks still apply.
