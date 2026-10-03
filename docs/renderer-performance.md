# Renderer performance measurements

The finale's GPU path still selects source-clock births and samples trajectories on
CPU. Moving spark motion to a vertex shader does not remove that work. The renderer
has no bloom pass: heads supply their own halos, followed by one output pass.

## Local Node evidence

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
slower and were discarded. The dominant remaining CPU work is birth selection and
sampling. Its cost has not been reduced here. The owner-reported 40 ms browser
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

## Exactly what the owner and composer should rerun

1. Composer: run `corepack pnpm check`, including existing shader transform-feedback
   parity and `tests/browser/camera-player.spec.ts`. Capture desktop and 390 px
   light/dark app screenshots plus the prototype comparison. Do not update goldens
   or accept altered baselines to make the checks pass.
2. Owner: in the same foreground browser/window, run each spray path from Restart
   through the dense finale at normal speed in standard and large views. Repeat a
   warmed run. Record median/p95 intervals, build mode, viewport and device.
3. At fixed 5, 11.2, 13 and 14 s instants, collect **Profile one frame** for both paths.
   Record every CPU/GPU row and extension status. Disable shake only for still-image
   comparisons, and keep smoke/stars/grid identical between performance runs.
4. Repeat steps 2 and 3 against a production build. Use an isolated output directory
   and unused port so the owner's dev server is preserved:

   ```sh
   NEXT_DIST_DIR=.next-performance corepack pnpm build
   NEXT_DIST_DIR=.next-performance corepack pnpm start --port 3007
   ```

   Open `http://localhost:3007/dev/fireworks`. Do not rebuild into that directory
   while its server is running. Next may add generated type paths to `tsconfig.json`;
   the composer should remove those temporary paths after the comparison.

5. In both builds, drag, wheel-zoom and touch-orbit/pinch on the large single view
   and large finale. Check ground zoom, free Shift/right-drag pan, reset, settings
   after reload, Space with canvas focus and Space with play-button focus.

Needs owner review. These measurements do not claim the 40 ms interval is fixed.
