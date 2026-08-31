'use client';

/**
 * CssCover - renders a saved {@link CssCover} config as a layered CSS/SVG
 * surface (plus a few small Canvas2D kinds). It is the lightweight counterpart
 * to {@link ./ShaderCover}: no WebGL context, cheap to animate (CSS layers use
 * transform/opacity only, so they stay on the compositor), and a pure function
 * of its config plus `frame`. Passing `animate={false}` pauses every layer at a
 * fixed, deterministic pose, so the frozen "photo" matches the live effect.
 */
import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import {
  CSS_COVER_LOOP_SECONDS,
  cssCoverBackdropColor,
  cssCoverGradient,
  normaliseCssCoverColors,
  type CssCover as CssCoverConfig,
  type CssCoverKind,
} from '@/lib/css-cover';
import { cn } from '@/lib/utils';
import styles from './CssCover.module.css';

// Tileable fractal-noise texture, reused for the grain overlay and the nebula
// kind. Kept as a base64 data URI so the internal SVG filter fragment
// (`url(#n)`) cannot be misread as a page-relative `/.../#n` request.
const NOISE_URL =
  'url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScxNjAnIGhlaWdodD0nMTYwJz48ZmlsdGVyIGlkPSduJz48ZmVUdXJidWxlbmNlIHR5cGU9J2ZyYWN0YWxOb2lzZScgYmFzZUZyZXF1ZW5jeT0nMC45JyBudW1PY3RhdmVzPScyJyBzdGl0Y2hUaWxlcz0nc3RpdGNoJy8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9JzEwMCUnIGhlaWdodD0nMTAwJScgZmlsdGVyPSd1cmwoI24pJy8+PC9zdmc+")';

// Kinds that read as "light over dark" want a dark base so screen-blended
// highlights pop; the rest sit over the bright palette gradient.
const LIGHT_BASE_KINDS = new Set<CssCoverKind>(['aurora']);

function hexToRgba(hex: string, alpha: number): string {
  const numeric = Number.parseInt(hex.slice(1), 16);
  const r = (numeric >> 16) & 255;
  const g = (numeric >> 8) & 255;
  const b = numeric & 255;
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
}

/** Inline animation timing for one layer. `factor` scales its loop length so
 * layers can move at related-but-different tempos while still freezing cleanly. */
function layerAnim(speed: number, frame: number, animate: boolean, factor = 1): CSSProperties {
  const duration = (CSS_COVER_LOOP_SECONDS / Math.max(speed, 0.05)) * factor;
  return {
    animationDuration: `${duration.toFixed(3)}s`,
    // Negative delay sets the starting phase; live continues from `frame`,
    // frozen pauses on exactly that pose.
    animationDelay: `${(-frame * factor).toFixed(3)}s`,
    animationPlayState: animate ? 'running' : 'paused',
  };
}

export function CssCover({
  cover,
  animate = true,
  className,
}: {
  cover: CssCoverConfig;
  /** When false, every layer is paused on the deterministic `frame` pose. */
  animate?: boolean;
  className?: string;
}) {
  const colors = useMemo(() => normaliseCssCoverColors(cover.colors), [cover.colors]);
  const back = useMemo(() => cssCoverBackdropColor({ colors }), [colors]);
  const gradient = useMemo(() => cssCoverGradient({ colors }), [colors]);
  const colour = (index: number) => colors[index % colors.length]!;

  const rootVars = {
    '--back': back,
    '--blur': cover.blur,
    '--grain': cover.grain,
  } as CSSProperties;

  const base = LIGHT_BASE_KINDS.has(cover.kind)
    ? gradient
    : `radial-gradient(circle at 50% 36%, ${hexToRgba(colour(0), 0.22)} 0%, #070b16 60%, #04060c 100%)`;

  return (
    <div className={cn(styles.root, className)} style={rootVars} aria-hidden="true">
      <div className={styles.base} style={{ background: base }} />
      {renderKind(cover, colors, colour, animate)}
      {cover.grain > 0.01 ? (
        <div
          className={styles.grain}
          style={{ backgroundImage: NOISE_URL, backgroundSize: '180px 180px' }}
        />
      ) : null}
    </div>
  );
}

function renderKind(
  cover: CssCoverConfig,
  colors: string[],
  colour: (index: number) => string,
  animate: boolean,
) {
  const { kind, speed, frame, scale, angle, density, intensity } = cover;

  if (kind === 'aurora') {
    const blobs = [
      { klass: styles.driftA, factor: 1, at: ['28%', '32%'], size: 78, colour: colour(0) },
      { klass: styles.driftB, factor: 1.35, at: ['70%', '28%'], size: 70, colour: colour(1) },
      { klass: styles.driftC, factor: 0.85, at: ['58%', '72%'], size: 82, colour: colour(2) },
      { klass: styles.driftA, factor: 1.6, at: ['24%', '76%'], size: 62, colour: colour(3) },
    ];
    return (
      <>
        {blobs.map((blob, index) => (
          <div
            key={index}
            className={cn(styles.layer, styles.animated, styles.auroraBlob, blob.klass)}
            style={{
              left: blob.at[0],
              top: blob.at[1],
              width: `${blob.size * scale}%`,
              height: `${blob.size * scale}%`,
              background: `radial-gradient(circle, ${hexToRgba(blob.colour, 0.9)} 0%, ${hexToRgba(
                blob.colour,
                0,
              )} 68%)`,
              ...layerAnim(speed, frame, animate, blob.factor),
            }}
          />
        ))}
      </>
    );
  }

  if (kind === 'rays') {
    const step = 4 + Math.round((1 - density) * 8); // sparse..dense angular period
    const rays = `repeating-conic-gradient(from ${angle}deg at 50% 50%, ${hexToRgba(
      colour(0),
      0,
    )} 0deg, ${hexToRgba(colour(0), Math.min(1, 0.85 * intensity))} ${step / 2}deg, ${hexToRgba(
      colour(0),
      0,
    )} ${step}deg)`;
    // Masks the shafts so they are brightest at the core and fade out with
    // radius: reads as beams of light, not a flat sunburst. The mask is on the
    // big rotating square, so its centre stays fixed at the frame centre.
    const mask =
      'radial-gradient(circle at 50% 50%, #000 0%, #000 8%, rgba(0,0,0,0.5) 22%, transparent 34%)';
    const bloom = `radial-gradient(circle at 50% 50%, ${hexToRgba(colour(1), intensity)} 0%, ${hexToRgba(
      colour(2),
      0.45 * intensity,
    )} 14%, transparent 46%)`;
    return (
      <>
        <div
          className={cn(styles.layer, styles.wheel, styles.animated, styles.rays)}
          style={{
            background: rays,
            maskImage: mask,
            WebkitMaskImage: mask,
            ...layerAnim(speed, frame, animate, 6),
          }}
        />
        <div
          className={cn(styles.layer, styles.fill, styles.animated, styles.raysBloom)}
          style={{ background: bloom, ...layerAnim(speed, frame, animate, 1.4) }}
        />
      </>
    );
  }

  if (kind === 'curtain') {
    // Aurora borealis curtains: skewed vertical bands drifting sideways under a
    // static vertical fade mask, over the dark base.
    const band = Math.max(6, Math.round(8 + (1 - density) * 12));
    const bands = (offset: number, alpha: number) =>
      `repeating-linear-gradient(${90 + (angle % 30) - 15}deg, transparent 0%, ${hexToRgba(
        colour(offset),
        alpha,
      )} ${band * 0.4}%, ${hexToRgba(colour(offset + 1), alpha * 0.8)} ${band * 0.6}%, transparent ${band}%)`;
    const mask =
      'linear-gradient(to bottom, transparent 2%, #000 26%, rgba(0,0,0,0.55) 62%, transparent 92%)';
    return (
      <>
        <div
          className={cn(styles.layer, styles.oversized, styles.animated, styles.curtainA)}
          style={{
            background: bands(0, Math.min(1, 0.75 * intensity)),
            maskImage: mask,
            WebkitMaskImage: mask,
            ...layerAnim(speed, frame, animate, 1.6),
          }}
        />
        <div
          className={cn(styles.layer, styles.oversized, styles.animated, styles.curtainB)}
          style={{
            background: bands(2, Math.min(1, 0.55 * intensity)),
            maskImage: mask,
            WebkitMaskImage: mask,
            ...layerAnim(speed, frame, animate, 2.3),
          }}
        />
        <div
          className={cn(styles.layer, styles.fill)}
          style={{
            background: `radial-gradient(120% 60% at 50% 8%, ${hexToRgba(colour(1), 0.3 * intensity)} 0%, transparent 62%)`,
            mixBlendMode: 'screen',
          }}
        />
      </>
    );
  }

  if (kind === 'plasma') {
    const blobs = [
      { klass: styles.plasmaA, factor: 0.55, at: ['30%', '34%'], size: 92, colour: colour(0) },
      { klass: styles.plasmaB, factor: 0.7, at: ['70%', '30%'], size: 88, colour: colour(1) },
      { klass: styles.plasmaC, factor: 0.5, at: ['60%', '72%'], size: 96, colour: colour(2) },
      { klass: styles.plasmaB, factor: 0.85, at: ['26%', '70%'], size: 84, colour: colour(3) },
    ];
    return (
      <>
        {blobs.map((blob, index) => (
          <div
            key={index}
            className={cn(styles.layer, styles.animated, styles.plasmaBlob, blob.klass)}
            style={{
              left: blob.at[0],
              top: blob.at[1],
              width: `${blob.size * scale}%`,
              height: `${blob.size * scale}%`,
              background: `radial-gradient(circle, ${hexToRgba(blob.colour, 0.95)} 0%, ${hexToRgba(
                blob.colour,
                0,
              )} 66%)`,
              ...layerAnim(speed, frame, animate, blob.factor),
            }}
          />
        ))}
      </>
    );
  }

  if (kind === 'kaleido') {
    const wheel = `conic-gradient(from ${angle}deg, ${colors.concat(colors[0]!).join(', ')})`;
    return (
      <>
        <div
          className={cn(styles.layer, styles.wheel, styles.animated, styles.kaleido)}
          style={{ background: wheel, ...layerAnim(speed, frame, animate, 0.28) }}
        />
        <div
          className={cn(styles.layer, styles.wheel, styles.animated, styles.kaleidoMirror)}
          style={{ background: wheel, ...layerAnim(speed, frame, animate, 0.42) }}
        />
      </>
    );
  }

  if (kind === 'grid') {
    const gridBg = [
      `repeating-linear-gradient(0deg, transparent 0 9.6%, ${hexToRgba(colour(0), 0.75 * intensity)} 9.6% 10%)`,
      `repeating-linear-gradient(90deg, transparent 0 4.6%, ${hexToRgba(colour(1), 0.5 * intensity)} 4.6% 5%)`,
    ].join(', ');
    const horizon = `radial-gradient(140% 62% at 50% 40%, ${hexToRgba(
      colour(2),
      intensity,
    )} 0%, ${hexToRgba(colour(0), 0.4 * intensity)} 26%, transparent 60%)`;
    return (
      <>
        <div className={cn(styles.layer, styles.fill, styles.gridPerspective)}>
          <div className={styles.gridPlane}>
            <div
              className={cn(styles.gridScroll, styles.animated)}
              style={{ background: gridBg, ...layerAnim(speed, frame, animate, 0.3) }}
            />
          </div>
        </div>
        <div
          className={cn(styles.layer, styles.fill)}
          style={{ background: horizon, mixBlendMode: 'screen' }}
        />
      </>
    );
  }

  if (kind === 'dots') {
    return <DotsCanvas cover={cover} colors={colors} animate={animate} />;
  }

  if (kind === 'constellation') {
    return <ConstellationCanvas cover={cover} colors={colors} animate={animate} />;
  }

  if (kind === 'waves') {
    return <WavesCanvas cover={cover} colors={colors} animate={animate} />;
  }

  if (kind === 'starfield') {
    return <StarfieldCanvas cover={cover} colors={colors} animate={animate} />;
  }

  if (kind === 'liquid') {
    return <FieldCanvas cover={cover} colors={colors} animate={animate} field="liquid" />;
  }

  if (kind === 'silk') {
    return <FieldCanvas cover={cover} colors={colors} animate={animate} field="silk" />;
  }

  if (kind === 'caustics') {
    return <FieldCanvas cover={cover} colors={colors} animate={animate} field="caustics" />;
  }

  if (kind === 'marble') {
    return <FieldCanvas cover={cover} colors={colors} animate={animate} field="marble" />;
  }

  if (kind === 'smoke') {
    return <FieldCanvas cover={cover} colors={colors} animate={animate} field="smoke" />;
  }

  if (kind === 'spiro') {
    return <SpiroCanvas cover={cover} colors={colors} animate={animate} />;
  }

  // kind === 'bloom'
  return <BloomCanvas cover={cover} colors={colors} animate={animate} />;
}

/* ---------------------------------------------------------------------- */
/* Canvas kinds                                                           */
/* ---------------------------------------------------------------------- */

/** Local PRNG so canvas layouts are reproducible from the cover seed. */
function mulberry32(seedNumber: number): () => number {
  let a = seedNumber >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Small offscreen radial-glow sprite for one colour, drawn once and reused. */
function makeGlowSprite(colour: string): HTMLCanvasElement {
  const size = 64;
  const sprite = document.createElement('canvas');
  sprite.width = size;
  sprite.height = size;
  const ctx = sprite.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, hexToRgba(colour, 1));
    g.addColorStop(0.4, hexToRgba(colour, 0.5));
    g.addColorStop(1, hexToRgba(colour, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  return sprite;
}

/**
 * Shared harness for the Canvas2D kinds: handles DPR, resize, a ~30fps cap, and
 * the animate/frozen split. `draw(ctx, width, height, t)` must be a pure
 * function of `t` so freezing on `cover.frame` is deterministic.
 */
function runCanvas(
  canvas: HTMLCanvasElement,
  options: {
    animate: boolean;
    frame: number;
    fps?: number;
    draw: (ctx: CanvasRenderingContext2D, width: number, height: number, t: number) => void;
  },
): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  const reduceMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const shouldAnimate = options.animate && !reduceMotion;
  const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 1.5);

  let width = 0;
  let height = 0;
  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();

  let raf = 0;
  let last = 0;
  const start = performance.now();
  const minDelta = 1000 / (options.fps ?? 30);
  if (shouldAnimate) {
    const loop = (now: number) => {
      raf = window.requestAnimationFrame(loop);
      if (now - last < minDelta) return;
      last = now;
      ctx!.clearRect(0, 0, width, height);
      options.draw(ctx!, width, height, (now - start) / 1000 + options.frame);
    };
    raf = window.requestAnimationFrame(loop);
  } else {
    ctx.clearRect(0, 0, width, height);
    options.draw(ctx, width, height, options.frame);
  }

  const observer = new ResizeObserver(() => {
    resize();
    if (!shouldAnimate) {
      ctx.clearRect(0, 0, width, height);
      options.draw(ctx, width, height, options.frame);
    }
  });
  observer.observe(canvas);

  return () => {
    window.cancelAnimationFrame(raf);
    observer.disconnect();
  };
}

function BloomCanvas({
  cover,
  colors,
  animate,
}: {
  cover: CssCoverConfig;
  colors: string[];
  animate: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const sprites = colors.map((colour) => makeGlowSprite(colour));
    const count = Math.min(40, Math.round(14 + cover.density * 30));
    const rand = mulberry32(cover.seed);
    const particles = Array.from({ length: count }, () => ({
      baseX: rand(),
      baseY: rand(),
      size: rand(),
      speed: rand(),
      phase: rand(),
      sprite: sprites[Math.floor(rand() * sprites.length) % sprites.length]!,
    }));

    return runCanvas(canvas, {
      animate,
      frame: cover.frame,
      draw: (ctx, width, height, time) => {
        const t = time * cover.speed;
        ctx.globalCompositeOperation = 'lighter';
        const unit = Math.min(width, height) / 420;
        for (const p of particles) {
          const orbit = p.phase * Math.PI * 2 + t * (0.05 + p.speed * 0.12);
          const x = (p.baseX + Math.cos(orbit) * 0.045) * width;
          const y = (p.baseY + Math.sin(orbit * 0.8) * 0.05) * height;
          const glow = (6 + p.size * 16) * unit * cover.scale;
          const twinkle = 0.5 + 0.5 * Math.sin(t * (0.6 + p.speed) + p.phase * 6.283);
          ctx.globalAlpha = Math.max(0, Math.min(1, (0.2 + 0.7 * twinkle) * cover.intensity));
          ctx.drawImage(p.sprite, x - glow, y - glow, glow * 2, glow * 2);
        }
        ctx.globalAlpha = 1;
      },
    });
  }, [
    cover.seed,
    cover.density,
    cover.intensity,
    cover.scale,
    cover.speed,
    cover.frame,
    animate,
    colors,
  ]);

  return <canvas ref={canvasRef} className={styles.bloomCanvas} />;
}

function DotsCanvas({
  cover,
  colors,
  animate,
}: {
  cover: CssCoverConfig;
  colors: string[];
  animate: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    return runCanvas(canvas, {
      animate,
      frame: cover.frame,
      fps: 40,
      draw: (ctx, width, height, time) => {
        const t = time * cover.speed;
        ctx.globalCompositeOperation = 'lighter';
        const spacing = Math.max(18, (44 - cover.density * 20) / Math.max(cover.scale, 0.5));
        const cols = Math.min(58, Math.ceil(width / spacing) + 1);
        const rows = Math.min(58, Math.ceil(height / spacing) + 1);
        const ox = (width - (cols - 1) * spacing) / 2;
        const oy = (height - (rows - 1) * spacing) / 2;
        const baseR = spacing * 0.18;
        for (let j = 0; j < rows; j += 1) {
          for (let i = 0; i < cols; i += 1) {
            // Travelling diagonal wave modulates each dot's size, brightness
            // and colour band.
            const wave = Math.sin(i * 0.5 + j * 0.42 - t * 1.6);
            const m = 0.5 + 0.5 * wave;
            const r = baseR * (0.3 + m) * cover.scale;
            if (r <= 0.2) continue;
            const colour = colors[Math.round(m * (colors.length - 1)) % colors.length]!;
            ctx.globalAlpha = Math.max(0, Math.min(1, (0.2 + 0.7 * m) * cover.intensity));
            ctx.fillStyle = colour;
            ctx.beginPath();
            ctx.arc(ox + i * spacing, oy + j * spacing, r, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
      },
    });
  }, [cover.density, cover.intensity, cover.scale, cover.speed, cover.frame, animate, colors]);

  return <canvas ref={canvasRef} className={styles.bloomCanvas} />;
}

function ConstellationCanvas({
  cover,
  colors,
  animate,
}: {
  cover: CssCoverConfig;
  colors: string[];
  animate: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const count = Math.round(28 + cover.density * 46);
    const rand = mulberry32(cover.seed);
    const nodes = Array.from({ length: count }, () => ({
      bx: 0.08 + rand() * 0.84,
      by: 0.08 + rand() * 0.84,
      ax: 0.02 + rand() * 0.06,
      ay: 0.02 + rand() * 0.06,
      px: rand() * Math.PI * 2,
      py: rand() * Math.PI * 2,
      speed: 0.3 + rand() * 0.7,
      colour: colors[Math.floor(rand() * colors.length) % colors.length]!,
    }));
    const xs = new Float32Array(count);
    const ys = new Float32Array(count);

    return runCanvas(canvas, {
      animate,
      frame: cover.frame,
      fps: 40,
      draw: (ctx, width, height, time) => {
        const t = time * (0.4 + cover.speed * 0.6);
        for (let i = 0; i < count; i += 1) {
          const n = nodes[i]!;
          xs[i] = (n.bx + Math.cos(t * n.speed + n.px) * n.ax) * width;
          ys[i] = (n.by + Math.sin(t * n.speed + n.py) * n.ay) * height;
        }
        const maxD = Math.min(width, height) * 0.24;
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineWidth = 1;
        for (let i = 0; i < count; i += 1) {
          for (let k = i + 1; k < count; k += 1) {
            const dx = xs[i] - xs[k];
            const dy = ys[i] - ys[k];
            const d = Math.hypot(dx, dy);
            if (d < maxD) {
              ctx.globalAlpha = (1 - d / maxD) * 0.45 * cover.intensity;
              ctx.strokeStyle = nodes[i]!.colour;
              ctx.beginPath();
              ctx.moveTo(xs[i], ys[i]);
              ctx.lineTo(xs[k], ys[k]);
              ctx.stroke();
            }
          }
        }
        const unit = Math.min(width, height) / 500;
        for (let i = 0; i < count; i += 1) {
          const n = nodes[i]!;
          ctx.globalAlpha = 0.9 * cover.intensity;
          ctx.fillStyle = n.colour;
          ctx.beginPath();
          ctx.arc(xs[i], ys[i], (1.4 + n.speed * 1.6) * unit * cover.scale, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      },
    });
  }, [
    cover.seed,
    cover.density,
    cover.intensity,
    cover.scale,
    cover.speed,
    cover.frame,
    animate,
    colors,
  ]);

  return <canvas ref={canvasRef} className={styles.bloomCanvas} />;
}

function WavesCanvas({
  cover,
  colors,
  animate,
}: {
  cover: CssCoverConfig;
  colors: string[];
  animate: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const bandCount = 4 + Math.round(cover.density * 3);
    const rand = mulberry32(cover.seed);
    const bands = Array.from({ length: bandCount }, (_, k) => ({
      base: 0.32 + (k / bandCount) * 0.58,
      amp: 0.04 + rand() * 0.06,
      freq: (1.2 + rand() * 1.6) * Math.PI * 2,
      phase: rand() * Math.PI * 2,
      speed: 0.4 + rand() * 0.8,
      colour: colors[k % colors.length]!,
    }));

    return runCanvas(canvas, {
      animate,
      frame: cover.frame,
      fps: 40,
      draw: (ctx, width, height, time) => {
        const t = time * cover.speed;
        ctx.globalCompositeOperation = 'screen';
        const step = Math.max(6, width / 160);
        // Back to front so nearer bands overlap the far ones.
        for (let k = bandCount - 1; k >= 0; k -= 1) {
          const b = bands[k]!;
          ctx.beginPath();
          ctx.moveTo(0, height);
          for (let x = 0; x <= width; x += step) {
            const y =
              (b.base + b.amp * Math.sin((x / width) * b.freq + t * b.speed + b.phase)) * height;
            ctx.lineTo(x, y);
          }
          ctx.lineTo(width, height);
          ctx.closePath();
          const topY = (b.base - b.amp) * height;
          const gradient = ctx.createLinearGradient(0, topY, 0, height);
          gradient.addColorStop(0, hexToRgba(b.colour, 0.55 * cover.intensity));
          gradient.addColorStop(1, hexToRgba(b.colour, 0.05 * cover.intensity));
          ctx.fillStyle = gradient;
          ctx.fill();
        }
      },
    });
  }, [cover.seed, cover.density, cover.intensity, cover.speed, cover.frame, animate, colors]);

  return <canvas ref={canvasRef} className={styles.bloomCanvas} />;
}

function StarfieldCanvas({
  cover,
  colors,
  animate,
}: {
  cover: CssCoverConfig;
  colors: string[];
  animate: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const count = Math.round(70 + cover.density * 170);
    const rand = mulberry32(cover.seed);
    const stars = Array.from({ length: count }, () => ({
      angle: rand() * Math.PI * 2,
      base: rand(),
      speed: rand(),
      // Mostly white streaks with an occasional palette tint.
      colour:
        rand() > 0.72 ? colors[Math.floor(rand() * colors.length) % colors.length]! : '#ffffff',
    }));

    return runCanvas(canvas, {
      animate,
      frame: cover.frame,
      fps: 40,
      draw: (ctx, width, height, time) => {
        const t = time * (0.5 + cover.speed);
        const cx = width * 0.5;
        const cy = height * 0.5;
        const maxR = Math.hypot(cx, cy);
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        for (const s of stars) {
          const prog = (s.base + t * (0.05 + s.speed * 0.14)) % 1;
          const r = prog * prog * maxR;
          const rPrev = Math.max(0, prog - 0.03) ** 2 * maxR;
          const dx = Math.cos(s.angle);
          const dy = Math.sin(s.angle);
          ctx.strokeStyle = s.colour;
          ctx.globalAlpha = Math.min(1, prog * 1.8) * cover.intensity;
          ctx.lineWidth = (0.6 + prog * 2.2) * cover.scale;
          ctx.beginPath();
          ctx.moveTo(cx + dx * rPrev, cy + dy * rPrev);
          ctx.lineTo(cx + dx * r, cy + dy * r);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      },
    });
  }, [
    cover.seed,
    cover.density,
    cover.intensity,
    cover.scale,
    cover.speed,
    cover.frame,
    animate,
    colors,
  ]);

  return <canvas ref={canvasRef} className={styles.bloomCanvas} />;
}

/* ---------------------------------------------------------------------- */
/* Field kinds (low-res per-pixel "shader" canvases)                      */
/* ---------------------------------------------------------------------- */

// The field kinds mimic the WebGL paper-shader covers (mesh gradient, warp,
// noise banding, grain gradient) by shading a tiny pixel buffer on the CPU and
// letting the browser's bilinear upscale smooth it to full size. A ~128px-wide
// buffer is only a few thousand pixels, so a frame costs well under a
// millisecond - cheap enough for phones - while reading like a fragment
// shader. Every field is a pure function of `t`, so freezing works as usual.

type FieldKind = 'liquid' | 'silk' | 'caustics' | 'marble' | 'smoke';

const FIELD_WIDTHS: Record<FieldKind, number> = {
  liquid: 112,
  silk: 128,
  caustics: 160,
  marble: 144,
  smoke: 112,
};

function hexToRgbTuple(hex: string): [number, number, number] {
  const numeric = Number.parseInt(hex.slice(1), 16);
  return [(numeric >> 16) & 255, (numeric >> 8) & 255, numeric & 255];
}

/** 256-entry smooth palette LUT (RGB triplets). Wrapping keeps loops seamless. */
function makePaletteLut(colors: string[], wrap: boolean): Uint8ClampedArray {
  const rgb = colors.map(hexToRgbTuple);
  const n = rgb.length;
  const lut = new Uint8ClampedArray(256 * 3);
  const spans = wrap ? n : Math.max(1, n - 1);
  for (let i = 0; i < 256; i += 1) {
    const pos = (i / 255.0001) * spans;
    const k = Math.min(spans - 1, Math.floor(pos));
    let f = pos - k;
    f = f * f * (3 - 2 * f);
    const a = rgb[k % n]!;
    const b = rgb[(k + 1) % n]!;
    lut[i * 3] = a[0] + (b[0] - a[0]) * f;
    lut[i * 3 + 1] = a[1] + (b[1] - a[1]) * f;
    lut[i * 3 + 2] = a[2] + (b[2] - a[2]) * f;
  }
  return lut;
}

/**
 * Harness for the field kinds: owns the small ImageData buffer (sized to the
 * element's aspect ratio), the fps cap, and the animate/frozen split.
 * `render(data, width, height, t)` must be a pure function of `t`.
 */
function runFieldCanvas(
  canvas: HTMLCanvasElement,
  options: {
    animate: boolean;
    frame: number;
    fps?: number;
    baseWidth: number;
    render: (data: Uint8ClampedArray, width: number, height: number, t: number) => void;
  },
): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  const reduceMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const shouldAnimate = options.animate && !reduceMotion;

  let image: ImageData | null = null;

  function paint(t: number) {
    if (!image) return;
    options.render(image.data, image.width, image.height, t);
    ctx!.putImageData(image, 0, 0);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const aspect = rect.width > 0 ? rect.height / rect.width : 9 / 16;
    const width = options.baseWidth;
    const height = Math.max(16, Math.min(256, Math.round(width * aspect)));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      image = ctx!.createImageData(width, height);
      // Alpha never changes; set it once.
      for (let i = 3; i < image.data.length; i += 4) image.data[i] = 255;
    }
  }
  resize();

  let raf = 0;
  let last = 0;
  const start = performance.now();
  const minDelta = 1000 / (options.fps ?? 30);
  if (shouldAnimate) {
    const loop = (now: number) => {
      raf = window.requestAnimationFrame(loop);
      if (now - last < minDelta) return;
      last = now;
      paint((now - start) / 1000 + options.frame);
    };
    raf = window.requestAnimationFrame(loop);
  } else {
    paint(options.frame);
  }

  const observer = new ResizeObserver(() => {
    resize();
    if (!shouldAnimate) paint(options.frame);
  });
  observer.observe(canvas);

  return () => {
    window.cancelAnimationFrame(raf);
    observer.disconnect();
  };
}

/** Builds the per-pixel renderer for one field kind from a cover config. */
function buildFieldRenderer(
  field: FieldKind,
  cover: CssCoverConfig,
  colors: string[],
): (data: Uint8ClampedArray, width: number, height: number, t: number) => void {
  const rand = mulberry32(cover.seed);
  const speed = cover.speed;
  const intensity = cover.intensity;

  if (field === 'liquid') {
    // Mesh-gradient look: colour sites orbit slowly and every pixel takes an
    // inverse-square-weighted mix of them, sampled through warped space.
    const sites = colors.slice(0, 6).map((c, index) => ({
      rgb: hexToRgbTuple(c),
      ox: 0.5 + (rand() - 0.5) * 0.55,
      oy: 0.5 + (rand() - 0.5) * 0.55,
      rx: 0.18 + rand() * 0.22,
      ry: 0.18 + rand() * 0.22,
      w: (0.35 + rand() * 0.45) * (index % 2 === 0 ? 1 : -1),
      p: rand() * Math.PI * 2,
    }));
    const warpAmp = 0.04 + cover.density * 0.08;
    const warpFreq = (4 + cover.scale * 3) * Math.PI;
    const cx = new Float32Array(sites.length);
    const cy = new Float32Array(sites.length);
    return (data, width, height, time) => {
      const t = time * speed;
      for (let s = 0; s < sites.length; s += 1) {
        const site = sites[s]!;
        cx[s] = site.ox + Math.cos(t * site.w + site.p) * site.rx;
        cy[s] = site.oy + Math.sin(t * site.w * 0.8 + site.p * 1.7) * site.ry;
      }
      // Hoist the row/column warp offsets out of the pixel loop.
      const colWarp = new Float32Array(width);
      for (let i = 0; i < width; i += 1) {
        colWarp[i] = Math.cos((i / width) * warpFreq - t * 0.4) * warpAmp;
      }
      let o = 0;
      for (let j = 0; j < height; j += 1) {
        const v = j / height;
        const rowWarp = Math.sin(v * warpFreq + t * 0.5) * warpAmp;
        for (let i = 0; i < width; i += 1) {
          const wu = i / width + rowWarp;
          const wv = v + colWarp[i]!;
          let r = 0;
          let g = 0;
          let b = 0;
          let wsum = 0;
          for (let s = 0; s < sites.length; s += 1) {
            const dx = wu - cx[s]!;
            const dy = wv - cy[s]!;
            const d2 = dx * dx + dy * dy + 0.012;
            const w = 1 / (d2 * d2);
            const rgb = sites[s]!.rgb;
            r += rgb[0] * w;
            g += rgb[1] * w;
            b += rgb[2] * w;
            wsum += w;
          }
          const inv = 1 / wsum;
          data[o] = r * inv;
          data[o + 1] = g * inv;
          data[o + 2] = b * inv;
          o += 4;
        }
      }
    };
  }

  if (field === 'silk') {
    // Warp-shader look: two nested sine domain-warps folded through a wrapped
    // palette, so colours flow like sheared silk.
    const ang = (cover.angle * Math.PI) / 180;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const f1 = (2.5 + rand() * 2 + cover.scale * 1.5) * Math.PI * 2;
    const f2 = (3 + rand() * 2.5) * Math.PI;
    const f3 = (2 + rand() * 2) * Math.PI * 2;
    const f4 = (3.5 + rand() * 2) * Math.PI;
    const amp = 1.4 + cover.density * 1.4;
    const lut = makePaletteLut(colors, true);
    return (data, width, height, time) => {
      const t = time * speed * 0.5;
      let o = 0;
      for (let j = 0; j < height; j += 1) {
        const y0 = j / height - 0.5;
        for (let i = 0; i < width; i += 1) {
          const x0 = i / width - 0.5;
          const px = x0 * ca - y0 * sa;
          const py = x0 * sa + y0 * ca;
          const q = Math.sin(px * f1 + t + amp * Math.sin(py * f2 + t * 0.8));
          const w = Math.sin(py * f3 - t * 0.7 + amp * Math.sin(px * f4 - t * 0.6));
          let vv = (q + w) * 0.25 + 0.5;
          vv -= Math.floor(vv);
          const idx = (vv * 255) | 0;
          data[o] = lut[idx * 3]!;
          data[o + 1] = lut[idx * 3 + 1]!;
          data[o + 2] = lut[idx * 3 + 2]!;
          o += 4;
        }
      }
    };
  }

  if (field === 'caustics') {
    // Water-light interference: three drifting plane waves whose product folds
    // into bright ridges over a deep-to-shallow palette gradient.
    const dirs = Array.from({ length: 3 }, (_, k) => {
      const a = (k / 3) * Math.PI + rand() * 0.8;
      return {
        x: Math.cos(a),
        y: Math.sin(a),
        f: (5 + rand() * 4) * (0.6 + cover.scale * 0.5) * Math.PI,
        s: (0.9 + rand() * 1.5) * (k % 2 ? -1 : 1),
      };
    });
    const deep = hexToRgbTuple(colors[0]!);
    const shallow = hexToRgbTuple(colors[1 % colors.length]!);
    const glint = hexToRgbTuple(colors[2 % colors.length]!);
    return (data, width, height, time) => {
      const t = time * speed;
      const aspect = width / Math.max(1, height);
      let o = 0;
      for (let j = 0; j < height; j += 1) {
        const v = j / height;
        const mix = 0.62 - v * 0.42;
        const baseR = deep[0] + (shallow[0] - deep[0]) * mix;
        const baseG = deep[1] + (shallow[1] - deep[1]) * mix;
        const baseB = deep[2] + (shallow[2] - deep[2]) * mix;
        for (let i = 0; i < width; i += 1) {
          const u = (i / width) * aspect;
          let m = 1;
          for (let k = 0; k < 3; k += 1) {
            const dd = dirs[k]!;
            m *= 0.5 + 0.5 * Math.sin((u * dd.x + v * dd.y) * dd.f + t * dd.s);
          }
          const c = m * m * 2.6 * intensity;
          data[o] = baseR + (glint[0] * 0.4 + 153) * c;
          data[o + 1] = baseG + (glint[1] * 0.4 + 153) * c;
          data[o + 2] = baseB + (glint[2] * 0.4 + 153) * c;
          o += 4;
        }
      }
    };
  }

  if (field === 'marble') {
    // Simplex-banding look: rings warped around a drifting centre, quantised
    // into stepped palette bands. Swirl factors are integers so the field is
    // continuous across the atan2 branch cut.
    const swirl = 1 + Math.round(cover.density * 3);
    const rings = (2.4 + cover.scale * 2.4) * Math.PI * 2;
    const bands = Math.max(4, colors.length * 2);
    const lut = makePaletteLut(colors, true);
    const drift = 0.1 + rand() * 0.08;
    const p0 = rand() * Math.PI * 2;
    return (data, width, height, time) => {
      const t = time * speed * 0.6;
      const ccx = 0.5 + Math.cos(t * 0.31 + p0) * drift;
      const ccy = 0.5 + Math.sin(t * 0.24 + p0 * 1.6) * drift;
      const aspect = width / Math.max(1, height);
      let o = 0;
      for (let j = 0; j < height; j += 1) {
        const v = j / height;
        const dy = v - ccy;
        for (let i = 0; i < width; i += 1) {
          const dx = (i / width - ccx) * aspect;
          const rr = Math.sqrt(dx * dx + dy * dy);
          const aa = Math.atan2(dy, dx);
          let vv =
            0.5 + 0.5 * Math.sin(rr * rings - t + aa * swirl + 1.3 * Math.sin(aa * 3 + t * 0.5));
          vv = (Math.floor(vv * bands) + 0.5) / bands;
          const idx = Math.min(255, (vv * 255) | 0);
          data[o] = lut[idx * 3]!;
          data[o + 1] = lut[idx * 3 + 1]!;
          data[o + 2] = lut[idx * 3 + 2]!;
          o += 4;
        }
      }
    };
  }

  // field === 'smoke'
  // Grain-gradient / Neat-style drifting clouds: three octaves of seeded value
  // noise, each octave sliding in a different direction, through the palette.
  const SIZE = 33;
  const lattice = new Float32Array(SIZE * SIZE);
  for (let i = 0; i < lattice.length; i += 1) lattice[i] = rand();
  const wrapAt = SIZE - 1;
  const noise2 = (x: number, y: number): number => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    let fx = x - xi;
    let fy = y - yi;
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);
    const x0 = ((xi % wrapAt) + wrapAt) % wrapAt;
    const y0 = ((yi % wrapAt) + wrapAt) % wrapAt;
    const a = lattice[y0 * SIZE + x0]!;
    const b = lattice[y0 * SIZE + x0 + 1]!;
    const c = lattice[(y0 + 1) * SIZE + x0]!;
    const d = lattice[(y0 + 1) * SIZE + x0 + 1]!;
    const ab = a + (b - a) * fx;
    const cd = c + (d - c) * fx;
    return ab + (cd - ab) * fy;
  };
  const lut = makePaletteLut(colors, false);
  const baseFreq = 1.6 + cover.scale * 1.8;
  return (data, width, height, time) => {
    const t = time * speed;
    const o1x = t * 0.1;
    const o1y = t * 0.06;
    const o2x = -t * 0.14;
    const o2y = t * 0.09;
    const o3x = t * 0.2;
    const o3y = -t * 0.12;
    let o = 0;
    for (let j = 0; j < height; j += 1) {
      const v = j / height;
      const lift = (0.5 - v) * 0.12;
      for (let i = 0; i < width; i += 1) {
        const u = i / width;
        let n =
          0.55 * noise2(u * baseFreq + o1x, v * baseFreq + o1y) +
          0.3 * noise2(u * baseFreq * 2.1 + o2x, v * baseFreq * 2.1 + o2y) +
          0.15 * noise2(u * baseFreq * 4.3 + o3x, v * baseFreq * 4.3 + o3y);
        n = (n - 0.5) * (1.1 + intensity) + 0.5 + lift;
        const idx = n <= 0 ? 0 : n >= 1 ? 255 : (n * 255) | 0;
        data[o] = lut[idx * 3]!;
        data[o + 1] = lut[idx * 3 + 1]!;
        data[o + 2] = lut[idx * 3 + 2]!;
        o += 4;
      }
    }
  };
}

function FieldCanvas({
  cover,
  colors,
  animate,
  field,
}: {
  cover: CssCoverConfig;
  colors: string[];
  animate: boolean;
  field: FieldKind;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    return runFieldCanvas(canvas, {
      animate,
      frame: cover.frame,
      fps: field === 'smoke' ? 24 : 30,
      baseWidth: Math.round(FIELD_WIDTHS[field] * (0.8 + cover.scale * 0.25)),
      render: buildFieldRenderer(field, cover, colors),
    });
  }, [field, cover, animate, colors]);

  return <canvas ref={canvasRef} className={styles.fieldCanvas} />;
}

/** A glowing spirograph curve slowly rotating, drawn in palette segments. */
function SpiroCanvas({
  cover,
  colors,
  animate,
}: {
  cover: CssCoverConfig;
  colors: string[];
  animate: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rand = mulberry32(cover.seed);
    const ratios: Array<[number, number]> = [
      [5, 2],
      [7, 3],
      [8, 3],
      [9, 4],
      [10, 3],
    ];
    const [big, small] = ratios[Math.floor(rand() * ratios.length) % ratios.length]!;
    const d = small * (0.55 + rand() * 0.7);
    // Hypotrochoid, precomputed once; the whole curve just rotates and pulses.
    const revolutions = small;
    const steps = 90 * revolutions;
    const pts: Array<[number, number]> = [];
    let maxNorm = 0.0001;
    for (let i = 0; i <= steps; i += 1) {
      const theta = (i / steps) * Math.PI * 2 * revolutions;
      const x = (big - small) * Math.cos(theta) + d * Math.cos(((big - small) / small) * theta);
      const y = (big - small) * Math.sin(theta) - d * Math.sin(((big - small) / small) * theta);
      pts.push([x, y]);
      maxNorm = Math.max(maxNorm, Math.hypot(x, y));
    }
    const points = pts.map(([x, y]) => [x / maxNorm, y / maxNorm] as [number, number]);
    const segments = colors.length;
    const perSegment = Math.ceil(points.length / segments);

    return runCanvas(canvas, {
      animate,
      frame: cover.frame,
      draw: (ctx, width, height, time) => {
        const t = time * cover.speed;
        const cx = width * 0.5;
        const cy = height * 0.5;
        const radius =
          Math.min(width, height) * 0.4 * cover.scale * (1 + 0.045 * Math.sin(t * 0.7));
        const rotation = t * 0.16;
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (let s = 0; s < segments; s += 1) {
          const from = s * perSegment;
          const to = Math.min(points.length - 1, from + perSegment);
          if (from >= points.length - 1) break;
          const path = new Path2D();
          for (let i = from; i <= to; i += 1) {
            const [px, py] = points[i]!;
            const x = cx + (px * cos - py * sin) * radius;
            const y = cy + (px * sin + py * cos) * radius;
            if (i === from) path.moveTo(x, y);
            else path.lineTo(x, y);
          }
          const colour = colors[s % colors.length]!;
          const passes: Array<[number, number]> = [
            [7, 0.12],
            [1.6, 0.85],
          ];
          for (const [lineWidth, alpha] of passes) {
            ctx.globalAlpha = Math.min(1, alpha * cover.intensity * 1.15);
            ctx.strokeStyle = colour;
            ctx.lineWidth = lineWidth;
            ctx.stroke(path);
          }
        }
        ctx.globalAlpha = 1;
      },
    });
  }, [cover.seed, cover.intensity, cover.scale, cover.speed, cover.frame, animate, colors]);

  return <canvas ref={canvasRef} className={styles.bloomCanvas} />;
}
