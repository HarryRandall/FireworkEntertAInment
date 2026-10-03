# Poster snapshots

`tests/browser/posters.spec.ts` exercises the public shared-context poster API through
`/dev/fireworks`. Each fixture and representative template is compared on every browser
check. Set `POSTER_SNAPSHOTS_ALL=1` to compare all 99 templates and three fixtures.

PNG baselines are 160 × 100 pixels, at device scale factor 1. The test waits for each
published blob URL and the image's `decode()` promise, rather than sleeping. Posters use
the stored seed, their developed moment, kind-specific framing and fresh browser settings.
The image screenshot uses `HIDE_PLAYER_OVERLAY`; live frame comparisons use
`captureRenderer` so player focus and hover states cannot alter the comparison.

The perceptual comparison uses Pixelmatch's YIQ colour-distance threshold of **0.15**,
with at most **1%** differing pixels. This is an initial visual tolerance for small
software-GL colour and edge rounding, not a measured hardware parity guarantee. It
should reject changed framing, missing particles and wrong capture moments. The composer
must inspect the numerical diffs and the owner must approve the images before accepting
or updating a baseline. Do not relax the thresholds to hide a regression.

Use Node 24 and the pinned pnpm via corepack. With Chromium installed and the local dev
server available, generate all committed baseline PNGs with:

```bash
POSTER_SNAPSHOTS_ALL=1 corepack pnpm exec playwright test tests/browser/posters.spec.ts --update-snapshots
```

This writes `fixture-*.png` and template-key PNGs into this directory. Commit the PNGs
after the numerical check and owner visual review. To compare without updating:

```bash
corepack pnpm test:browser
POSTER_SNAPSHOTS_ALL=1 corepack pnpm exec playwright test tests/browser/posters.spec.ts
```

To typecheck the browser tests without launching Chromium:

```bash
corepack pnpm exec tsc -p tests/browser/tsconfig.json
```

The nightly poster workflow runs the full catalogue against the approved images. Missing
baselines are failures. Device/driver results and desktop/390 px light/dark review
screenshots remain separate evidence from these software-GL thumbnails.
