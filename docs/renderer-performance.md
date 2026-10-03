# Renderer performance measurements

The GPU path selects source-clock births and samples analytic trajectories in the
vertex shader. The CPU submits one parameter record and one current clock per source,
with no loop over spark slots or births. The renderer has no bloom pass: heads supply
their own halos, followed by one output pass.

## GPU birth selection: local Node comparison

Measured on 3 October 2026 using Node 24.18.0. The forty-shot recipe, fixed instants,
30 warm-up frames and 100 measured frames are unchanged. The script runs the retained
sampled-birth receiver (`gpu-sampled`, before), analytic source receiver (`gpu`, after)
and CPU reference consecutively in one process. Both GPU paths use the same current
non-spray simulation and packing. No Git checkout or index is changed. The separate
pre-edit run is retained as a cross-check, not mixed into this table.

Medians in milliseconds, including the phase observer overhead:

| Show time (s) | Spray CPU before | Spray CPU after | Total CPU before | Total CPU after | Sources | GPU candidates |
| ------------: | ---------------: | --------------: | ---------------: | --------------: | ------: | -------------: |
|             5 |            3.973 |           0.232 |            4.615 |           0.752 |     415 |        387,616 |
|          11.2 |            8.654 |           0.495 |            9.885 |           1.473 |     844 |        849,776 |
|            13 |            8.383 |           0.560 |            9.834 |           1.786 |     950 |        959,704 |
|            14 |           16.462 |           0.594 |           17.772 |           1.707 |   1,020 |        913,816 |

At 14 s, measured spray CPU work falls by 96.4%. An earlier paired run measured
16.531 -> 0.425 ms spray work and 17.969 -> 1.483 ms total. Run-to-run variation is
visible in the sampled path, so these are local medians, not universal budgets. Total CPU here means simulation plus
attribute packing/staging, excluding driver uploads, GPU execution, React, transfer,
and display cadence. Remaining CPU work scales with sources, stars and smoke. Raising
a single source's nominal spark count from 20 to 2,000 produces over ninety times as
many GPU candidates while keeping one CPU submission and the same source storage.
The Node behaviour test makes its CPU trajectory callback throw if sampled.

Source controls and reduced phase anchors occupy 67 RGBA texels per source. Ordered
motion modifiers retain the schema's sixteen-operation bound. The CPU anchors each
source at its last slot, reduces all independent phases modulo a full turn in Float64,
and packs the current clock as an offset from that anchor. Bee harmonics are reduced
separately, after their phase ratios and offsets. Child age is reduced before upload.
These anchors refresh the source texture as time advances, increasing upload traffic;
the table above includes their CPU packing cost, but excludes driver uploads.
A separate small clock texture carries four exact 16-bit limbs per source each frame. Integer-word binary64
arithmetic preserves the CPU's flicker hash tick at rounding boundaries, avoiding a
neighbouring random stream when a Float32 clock rounds across an integer. A local
integer arithmetic audit compared 804,858 prototype-derived birth clocks and signed
edge cases with native Node binary64: zero mismatches. This is algorithm evidence,
not shader execution evidence.

Each candidate derives its slot, clustered identity, birth time, varied lifetime,
origin, alpha and inherited velocity before invoking the shared spark shader. Candidate
ranges include inactive cluster/lifetime/streak/fork lanes. The GPU now processes more
vertices than the sampled path: 913,816 candidates at 14 s versus 80,371 sampled rows.
The readout's GPU count includes candidates, not just visible sparks. GPU cost may
increase, especially on software GL and mobile devices, and is unmeasured here. The
candidate index limit is the exact Float32 integer range, with a visible failure if a
scene exceeds it. This change does not claim a browser FPS improvement or prove the
owner's 40 ms interval is fixed.

Birth transform-feedback tests use the live source kernels and original CPU callbacks.
They cover fixed times, source shutdown edges and direct seeks, including launch sway,
spirals/jitter/wobble, star modifiers, ground sources, child trails and inheritance.
Readback is capped at 256 candidates per instant. Each new case has a 19 s timeout;
the composer reported nine moving-source appearance failures in the earlier version,
while static sources passed. The precision correction is not yet verified in Chromium.
IDs and visibility must match exactly.
Birth tolerances are 2 microseconds, 1 mm origin and 0.015 m/s inherited velocity, plus
100 Float32 ulps of relative error. The velocity bound accounts for cancellation over
the reference's 16 ms finite difference. Full spark appearance uses the existing,
unchanged position/appearance tolerances. Velocity samples now share one birth phase
and apply the 16 ms angular advance with sine/cosine angle addition, avoiding independent
rounding of two large phase arguments. Position subtraction happens relative to the
source centre. The wheel ramp uses an algebraic difference across its one-second edge.
A local Float32 arithmetic model over forward/backward wheel samples measured a maximum
0.0002393 m/s inherited-velocity error. This model uses Node trigonometry rounded to
Float32 and is not shader execution evidence. No browser tolerance was widened.
The renderer suite passes 500 tests, including goldens and template parity.
Separate integer-clock feedback cases test
nearest-even rounding, cancellation and signed ID extremes.

Reproduce from the repository root with Node 24:

```sh
node --import ./scripts/register-typescript.mjs packages/fireworks/scripts/profile-finale.mjs --phases
```

Raw data: ignored `output/performance/gpu-births-before.jsonl` (pre-edit) and
`output/performance/gpu-births-comparison.jsonl` (earlier paired run) and
`output/performance/gpu-births-final.jsonl` (before the precision correction) and
`output/performance/gpu-births-precision.jsonl` (current paired run shown in the table).
`cpuParticles`, `sampledBirthCandidates`, `sources` and `candidates` describe different
populations. They must not be summed or treated as visible GPU spark counts.

## Earlier packing comparison

Measured on 3 October 2026 using Node 24.18.0 and the unchanged forty-shot recipe.
Each time/path has 30 warm-up frames and 100 measured frames. Numbers below are
medians in milliseconds. The baseline loads the packing module from immutable Git
revision `d9405ea221c685675fa3f53a60bd9115b3274301`, with the same current simulation
and shaders. It never changes the index, branch or checkout. Driver uploads, GPU
execution, React, page transfer and display cadence are excluded.

| Path | Show time (s) | Packing before | Packing after | Total before | Total after |
| ---- | ------------: | -------------: | ------------: | -----------: | ----------: |
| GPU  |             5 |          0.081 |         0.046 |        4.839 |       4.711 |
| GPU  |          11.2 |          0.133 |         0.067 |       10.173 |      10.201 |
| GPU  |            13 |          0.219 |         0.094 |       10.229 |      10.168 |
| GPU  |            14 |          0.153 |         0.077 |       18.471 |      17.995 |
| CPU  |             5 |          2.893 |         0.675 |       12.644 |       8.178 |
| CPU  |          11.2 |          4.670 |         1.219 |       21.310 |      16.294 |
| CPU  |            13 |          4.369 |         1.239 |       20.054 |      16.403 |
| CPU  |            14 |          5.291 |         1.544 |       23.645 |      20.640 |

Direct scalar packing removes a routing object and two temporary typed-array views
per additive particle. Every position, colour, size, alpha, shape and ordering is
checked against the original routing contract. CPU packing at 14 s falls by 71%.
Simulation timing varied between sequential runs; this table proves a packing
improvement, not a GPU-frame-rate improvement. GPU-path packing was already small.

An instrumented Node sample at 14 s measured 1.055 ms for non-spray simulation/frame
writing and 15.767 ms for GPU-path spray scheduling, birth sampling and birth packing.
The CPU path measured 3.406 ms and 14.091 ms respectively; its spray phase also
includes reference spark evaluation. Timing hooks add overhead. Birth counts differ
between paths because the GPU includes candidates hidden by the shader.

The combined Node CPU profile's leading simulation functions were `spraySlots`,
`spray`, the birth receiver and `starPos`. The original additive packing loop was
also a large allocation hotspot. Scheduling and trajectory cache experiments were
slower and were discarded. At that revision the dominant remaining CPU work was birth selection and
sampling. The source-birth comparison above measures its removal. The owner-reported 40 ms browser
interval is not fully explained without the browser/GPU measurements below.

Reproduce the measurements from the repository root:

```sh
node --import ./scripts/register-typescript.mjs packages/fireworks/scripts/profile-finale.mjs --baseline-ref d9405ea221c685675fa3f53a60bd9115b3274301
node --import ./scripts/register-typescript.mjs packages/fireworks/scripts/profile-finale.mjs
node --import ./scripts/register-typescript.mjs packages/fireworks/scripts/profile-finale.mjs --phases
node --import ./scripts/register-typescript.mjs --cpu-prof --cpu-prof-dir=output/performance packages/fireworks/scripts/profile-finale.mjs
```

Raw run data is in ignored `output/performance/before-final.jsonl`,
`after-final.jsonl` and `phases.jsonl`. The initial combined CPU profile is
`output/performance/CPU.20261003.170030.56250.0.001.cpuprofile`.

## Source birth diagnostic: native trig precision

The composer's 3 October Chromium/SwiftShader diagnostic captured 1,174 visible
wheel rows, 1,074 spiral rows and 1,043 falling-leaf rows. All source indices, slot
identities, sample indices and visibility flags match. The uploaded clock limbs
reconstruct the CPU binary64 clock exactly for every source; repeated draws agree.
The recorded upload controls are Float32, while both production DataTextures and
transform feedback use float textures and integer texel fetches, with no half-float
conversion or interpolated source sampling. Actual GPU texel readback is included
in the next diagnostic run to verify the upload independently.

Run the bounded Node report (one JSON file in memory at a time):

```sh
node --import ./scripts/register-typescript.mjs packages/fireworks/scripts/analyse-spray-diagnostic.mjs
```

The pre-fix report is `output/spray-diagnostic/analysis-before-trig-fix.jsonl`.
At wheel time 1.008 s, candidate 120, upload quantisation changes the origin by
0.000000236 m, while GPU inheritance differs by 0.035713 m/s. At spiral time 2.2 s,
candidate 41032, origin quantisation is 0.000000360 m but the GPU origin differs by
0.002653 m. At falling-leaf time 5 s, candidate 6001, these are 0.000000650 m and
0.000499 m respectively. Clock differences are sub-microsecond in these rows.

SwiftShader's [ShaderCore.cpp](https://swiftshader.googlesource.com/SwiftShader/+/refs/heads/master/src/Pipeline/ShaderCore.cpp)
uses the same fifth-degree sine approximation for highp and relaxed-precision sin/cos.
Substituting that polynomial in the independent birth mirror reproduces these three
GPU rows within 0.00000679 m/s, 0.00000197 m and 0.00000318 m respectively. This
identifies native trig evaluation as the first material divergence. Metre-scale radii
amplify the trig error; the 16 ms finite difference further amplifies it in inheritance.
Integer hashes and large phase upload rounding do not explain these residuals.

Source trajectories now use split-quadrant reduction and sine/cosine Taylor
polynomials on [-pi/4, pi/4]. A Node audit interprets the live GLSL expressions with
Float32 rounding over 200,001 signed angles and 387 quadrant-edge cases: worst
absolute sin/cos error 0.000000081. This is numerical algorithm evidence; the
corrected shader has not yet been executed in Chromium. CPU formulae, CPU goldens,
spark appearance tolerances and birth tolerances are unchanged.

Composer commands, preserving the development server on port 3000:

```sh
SPRAY_DIAGNOSTIC=1 corepack pnpm exec playwright test tests/browser/spray-birth-diagnostic.spec.ts
corepack pnpm exec playwright test tests/browser/spray-parity.spec.ts
corepack pnpm check
```

The expanded JSON adds `uploadReadback` (all source/control and clock texels, exact
comparison and replay) and per-row `phase` lanes (anchor, rate, local advance,
assembled angle, native sin/cos and corrected sin/cos against Math.sin/Math.cos of
the GPU angle). Inspect upload mismatch counts and the first trig divergence, then
require the existing birth and appearance parity checks to pass without tolerance
changes. Owner visual review and real-device GPU cost remain separate gates.

## One-frame browser profiling

On `/dev/fireworks`, run the finale, pause and seek to 5, 11.2, 13 and 14 seconds.
Choose a spray path, then **Profile one frame**. The panel records:

- CPU non-spray simulation and frame writing;
- spray scheduling, birth sampling and birth packing (plus the kernel in CPU mode);
- attribute packing and upload staging;
- CPU time inside buffer/texture upload APIs;
- CPU draw/output submission and optional asynchronous GPU scene/output queries.

GPU queries use `EXT_disjoint_timer_query_webgl2`. No synchronous GPU wait occurs.
Unsupported hardware reports unavailable values, and disjoint/context-loss samples
are discarded. The GPU scene query includes uploads performed lazily by three.js.
CPU upload interception exists only during that sampled draw and always restores
the original WebGL methods. Profile a warmed frame to exclude shader compilation.

## Development versus production

The installed Next.js 16.3.3 CLI docs describe development HMR/error reporting and
an optimised `next build`/`next start` path. Its Strict Mode documentation confirms
that extra lifecycle/render checks are development-only. The production webpack
client chunks are minified, including bundled three.js; renderer maths, passes,
shader code and pixel-ratio limits remain the same. React's development diagnostics
and refresh client are absent. The React diagnostic readout is limited to ten
updates per second during playback; the native player still receives each frame.
This readout change has not been timed in a browser.

A local production build succeeded and `next start` served `/dev/fireworks` with
HTTP 200. No Chromium, GPU completion, real-device interaction or production-build
frame-rate measurement was performed. Minification is not proof that development
mode caused the 25 fps result.

## Production before/after: exact owner and composer procedure

The composer runs the browser checks. The latest `corepack pnpm check` passed
formatting, lint-rule/database-tooling tests, package checks, Knip and the web check
(including its production build). All 38 browser cases failed before test execution:
Chromium's MachPortRendezvousServer bootstrap check returned Permission denied (1100)
inside the workspace sandbox. The three opt-in diagnostic cases were skipped.
No corrected shader execution, browser journeys, screenshots or visual baselines
were obtained. The fireworks package passed all 504 tests, including unchanged CPU
goldens and all 99 template parity tests; browser TypeScript compilation also passed.
The isolated production build passed and `next start --port 3008` served
`/dev/fireworks` with HTTP 200; that temporary server was stopped. No screenshots,
hardware GPU timings or production-build frame intervals were captured.

Use the same device, foreground browser, viewport, pixel ratio and settings for both
builds. Keep smoke/stars/grid identical and normal playback speed. Disable shake only
for still-image comparisons. Preserve the owner's development server on port 3000.

For the before build, the composer can extract the immutable camera/player base into
an isolated directory without changing either checkout, branch or index:

```sh
performance_baseline=$(mktemp -d /private/tmp/showcrafter-performance-before.XXXXXX)
git archive 3fb062787a7b4be7c87a5436d19ad119dc1d97c9 | tar -x -C "$performance_baseline"
cd "$performance_baseline"
fnm use 24
corepack pnpm install --frozen-lockfile
NEXT_DIST_DIR=.next-performance corepack pnpm build
NEXT_DIST_DIR=.next-performance corepack pnpm start --port 3006
```

The temporary snapshot needs the same local environment configuration as the working
checkout if the build requires it. Do not share its `node_modules` with the current
checkout: workspace links would then load the new renderer into the before build.
No hosted database is needed. Keep this server running for the comparison.

For the after build, in a separate terminal:

```sh
cd /Users/harry/projects/FireworkEntertAInment
fnm use 24
NEXT_DIST_DIR=.next-performance corepack pnpm build
NEXT_DIST_DIR=.next-performance corepack pnpm start --port 3007
```

These package commands invoke `next build --webpack` followed by `next start`, not
the development server. Do not rebuild into either directory while its server runs.
Next may add temporary generated type paths to `apps/web/tsconfig.json`; the composer
should remove only those paths after testing, preserving other changes.

1. Owner: open `http://localhost:3006/dev/fireworks` then
   `http://localhost:3007/dev/fireworks`. Use the forty-shot finale, select **GPU
   sprays**, Restart and play through the dense section at normal speed. Repeat a
   warmed run in standard and large views. Record median/p95 frame intervals, build
   revision, viewport, device and browser. Repeat with **CPU sprays** as a control.
2. Pause and seek separately to 5, 11.2, 13 and 14 s. Choose **Profile one frame**,
   first to warm compilation and then to record the sample. Collect every row:
   non-spray simulation/frame writing, spray work, packing/upload staging, driver
   buffer/texture uploads, CPU submission, GPU scene and GPU output. In the after GPU
   build, the existing spray row label refers to source packing and clock copying;
   birth selection and trajectory sampling are now part of the GPU scene query.
3. Record timer-query extension status. Wait for asynchronous query results; unavailable
   or disjoint measurements are not zero. GPU scene time includes lazy uploads.
   Compare CPU spray work with the Node table and check whether padded candidates and
   binary64 clock arithmetic raise GPU scene time enough to offset the CPU saving.
4. Composer: run `corepack pnpm check` with Chromium available. Keep CPU goldens,
   template parity, existing spray/camera/player tests and visual baselines unchanged.
   Confirm each new birth case actually completes within 20 s. Capture desktop and
   390 px light/dark screenshots and matching prototype comparisons for owner review.
5. Owner: compare the finale and all 99 template renders at identical seeds/times,
   especially late trails, glitter/forks and source shut-off. Seek backwards and
   forwards and change spray path. Compare a second warmed playback run in each build.

Needs owner review. Browser performance, GPU shader execution, real-device rendering
and visual equivalence remain verification gates, not inferred results.
