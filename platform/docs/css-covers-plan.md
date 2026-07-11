# Lightweight CSS covers

Plan and status for replacing the heavy live-WebGL cover/splash visuals with
cheap CSS/SVG effects that still look good, pause cleanly, and freeze to a photo
that matches exactly.

## Why

The generating/splash screen mounts a full-bleed `ShaderCover`, which runs a
`@paper-design/shaders` fragment shader every frame. `@firecms/neat` (real
Three.js) runs in a few other surfaces too. Both are GPU/CPU heavy, can only be
mounted once or twice before the page struggles, and cannot back a live browse
card each. Today browse cards already dodge this by freezing a PNG poster
(`render-cover-poster.tsx` -> `covers` bucket), but that capture grabs a raw
WebGL frame at a semi-random developed moment, which is why a show's frozen
"icon" can drift from what the user actually watched.

Goals:

- Cheap, smooth animated covers that do not spike CPU/GPU.
- A variety of distinct, good-looking effects.
- Freeze any effect to a still that is identical to the live frame.
- A dev playground to shuffle through every effect.

Decisions taken for this pass: build the effects with **CSS/SVG plus a tiny
Canvas2D layer**; keep the existing WebGL covers and add CSS covers as a
**lighter, coexisting option** (a "lite mode"), rather than ripping WebGL out.

## Core idea: deterministic freeze

A CSS cover is a pure function of `(kind, colours, params, frame)`. Every layer
animates on an infinite loop; freezing just sets `animation-play-state: paused`
with a fixed negative `animation-delay` derived from `frame`. Because the live
effect starts from that same phase, the frozen still is the exact frame that was
on screen. The Canvas2D kind (`bloom`) is drawn from a seeded PRNG as a pure
function of `t`, so it freezes the same way.

Consequence: the "photo that matches" problem disappears. A browse card can
render `<CssCover animate={false} />` at the show's saved `frame` and get a
pixel-identical still with no WebGL context and no PNG round-trip. Snapshotting
to a stored raster stays optional (see migration).

## What was built (this pass)

| File                                     | Role                                                                                                                                                                                   |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/css-cover.ts`                       | Pure, serialisable `CssCover` type + generators, mirrors `lib/shader-cover.ts`. Carries an `engine: 'css'` discriminator so both cover kinds can share the `cover_shader` JSON column. |
| `app/components/app/CssCover.tsx`        | Renders a `CssCover` as layered CSS/SVG plus the Canvas2D `bloom` kind. `animate` toggles live vs frozen.                                                                              |
| `app/components/app/CssCover.module.css` | Keyframes and layer classes. Colours/timing come in via CSS custom properties and inline duration/delay.                                                                               |
| `app/(dev)/dev/css-covers/`              | Playground route (`page.tsx` + `CssCoversPlayground.tsx`).                                                                                                                             |

`lib/css-cover.ts` intentionally reuses the shape and helpers of
`lib/shader-cover.ts` (palette building, colour normalisation, gradient
fallback, seeded/random/parse entry points) so nothing here is a bespoke,
incompatible cover object.

## Effect catalogue

Seventeen kinds. A third pass replaced the particle-style kinds (fireworks,
embers, comets, swirl, beams, neon, metaballs) with **field kinds**: low-res
per-pixel CPU "shaders" that reproduce the look of the live WebGL paper-shader
covers (mesh gradient, warp, noise banding, grain gradient). Each field shades
a tiny ImageData buffer (~112-160 px wide, a few thousand pixels) and lets the
browser's bilinear upscale plus a small static blur smooth it to full size, so
a frame costs well under a millisecond with no WebGL context - fine on phones
and weak GPUs. Fields remain pure functions of `t`, so deterministic freezing
still holds. The field kinds are listed first:

- **Liquid** - flowing mesh gradient: colour sites orbit slowly, every pixel is
  an inverse-square-weighted mix over gently warped space. Mirrors the WebGL
  `mesh-gradient` cover. CPU field.
- **Silk** - two nested sine domain-warps folded through a wrapped palette, so
  colours flow like sheared silk. Mirrors the `warp` cover. CPU field.
- **Caustics** - three drifting plane waves multiplied into bright water-light
  ridges over a deep-to-shallow palette gradient. CPU field.
- **Marble** - rings warped around a drifting centre with integer swirl, then
  quantised into stepped palette bands. Mirrors the `simplex-noise` banding.
  CPU field.
- **Smoke** - three octaves of seeded value noise sliding in different
  directions, mapped through the palette. Mirrors the `grain-gradient` / Neat
  look. CPU field.
- **Spiro** - a glowing hypotrochoid (spirograph) drawn in palette segments,
  slowly rotating and pulsing. Canvas2D.
- **Curtain** - aurora borealis: skewed vertical bands drifting sideways under a
  static vertical fade mask. Pure CSS.
- **Dots** - a grid of dots rippling with a travelling diagonal wave; the wave
  drives each dot's size, brightness and colour band. Canvas2D.
- **Constellation** - drifting nodes linked by lines when close, particle-network
  style. Canvas2D.
- **Retro Grid** - a neon grid in 3D perspective scrolling toward a glowing
  horizon. Pure CSS (perspective + transform).
- **Waves** - stacked oscillating gradient bands on `screen` blend. Canvas2D.
- **Starfield** - warp-speed stars streaking outward from centre. Canvas2D.
- **Plasma** - fast overlapping colour blobs on `screen` blend. Pure CSS.
- **Kaleido** - a spinning multi-colour conic wheel with a mirrored overlay,
  rendered on a large square so it covers the frame at every angle. Pure CSS.
- **Rays** - light beams radiating from a bright core: a rotating
  `repeating-conic-gradient` on a large square, radially masked so shafts fade
  out with distance, plus a pulsing centre bloom over a dark base. Pure CSS.
- **Aurora** - soft blurred colour blobs drifting on `screen` blend. Pure CSS.
- **Bloom** - drifting bokeh sparks over a gradient. Canvas2D.

Removed kinds so far: mesh, nebula, warp, ripple (too tame), then fireworks,
embers, comets, swirl, beams, neon, metaballs (wrong aesthetic - the goal is
the liquid shader look, not particles). Stored covers referencing removed kinds
fail `parseCssCover` and fall back to the gradient.

Every kind except Aurora renders over the dark radial base so screen/additive
highlights pop; Aurora sits over the bright palette gradient
(`cssCoverGradient`, instant paint); the field kinds paint every pixel and
cover the base entirely. An optional soft-light grain overlay (tileable SVG
noise) sits on top. Rotating full-cover layers (rays, kaleido) use a large
square (`.wheel`, 260%) so no frame corner is exposed on wide or tall aspect
ratios. The sprite/stroke Canvas2D kinds (spiro, dots, constellation, waves,
starfield, bloom) share `runCanvas` (DPR-aware, resize observed, ~30-40fps
capped); the field kinds share `runFieldCanvas` (fixed low-res buffer, 24-30fps
capped). Both are driven by draw functions that are pure in `t`, so freezing on
`frame` stays deterministic.

## Playground

Route: `/dev/css-covers` (in the existing `(dev)` group, matching
`/dev/paper-shaders`). It offers a **Single** view (large preview plus full
controls) and a **Gallery** view that renders all 17 kinds at once so you can
shuffle through them quickly. Controls: effect picker, Randomise, palette editor
(3-6 colours), Speed/Scale/Angle/Softness/Grain/Intensity/Density sliders, a
**Freeze/Play** toggle, a **Frozen frame** scrubber to preview the exact still a
show would save, a layout seed for the Bloom particles, and Copy cover JSON.

## Migration (coexist as a lite mode)

Staged so nothing in the live flow changes until we choose to flip it.

1. **Done** - lib, component, and playground. No app surface touched yet.
2. **Done - cover dispatcher** - `lib/cover.ts` exposes `ShowCover`
   (`ShaderCover | CssCover`), `parseCover` (dispatches on the `engine` field:
   absent -> WebGL, `css` -> CSS), `randomCover` (always CSS), `coverGradient`,
   and `isCssCover`. `app/components/app/Cover.tsx` renders the right engine.
   `lib/shows/mappers.ts`, `lib/admin/mappers.ts`, and
   `lib/admin/cover-posters.server.ts` parse through it; domain types
   (`show-domain`, `show-summary`, `admin.types`) carry `ShowCover`. The
   `cover_shader` column stores arbitrary JSON, so no schema change was needed.
3. **Done - splash** - `GeneratingShowAnimation` renders `<Cover>`; new-show
   creation (`shows/new/actions.ts`) and template cloning (`show-templates.ts`)
   store `randomCover()` (CSS); the session-persisted generation cover is CSS
   too. The legacy night-sky loading decorations (starfield container, horizon
   glow, burst sprites) were removed - the cover is the backdrop. Cover clock
   resume is engine-aware (CSS phases in real seconds).
4. **Done - card posters** - icons stay as stored rasters in the `covers`
   bucket (`cover_image_path`). `renderCoverToPng` now dispatches: CSS covers
   mount frozen (`animate={false}`) and are snapshotted with `html-to-image`
   as JPEG, so the stored poster equals the live still exactly; legacy WebGL
   covers keep the old develop-then-read-buffer path. `CoverPoster` falls back
   to `coverGradient` for either engine.
5. **Optional cleanup** - once legacy WebGL covers are rare, retire the
   paper-shaders/neat cover path if desired. The raw Three.js **firework
   renderer** (`FireworkReplayCanvas`) is out of scope and stays as is.

## Notes and risks

- Performance rule (enforced): animate **only** `transform` and `opacity` so
  every layer stays on the compositor. Filters (blur/saturate) and
  `background-position` are set statically and never animated, since animating
  them forces a full-screen repaint each frame (this was the original CPU
  pegging). The Bloom canvas reuses one glow sprite per colour, composites with
  `lighter`, and is capped to ~30fps.
- The playground seeds its first render deterministically (`cssCoverFromSeed`)
  and only calls `randomCssCover()` after mount, to avoid an SSR/client
  hydration mismatch.
- Respects `prefers-reduced-motion`: CSS animations pause via the module's media
  query; the Bloom canvas draws a single static frame.
- Keep cover params bounded (as the generators do) so covers never render
  harsh/muddy, mirroring the guidance in the design-system skill.
- `mix-blend-mode: screen` needs a dark-ish base to read as "light"; the shared
  gradient base handles this. On very light themes, check contrast of the
  overlaid progress card (already has its own backdrop).
- Verified: project `tsc --noEmit` is clean and ESLint passes on the new files.
