'use client';

/**
 * CardBorderTrace — animated gradient "snake" that draws down both sides
 * of a panel in two halves that meet at the bottom centre. Each half
 * starts at a top corner, runs down its side and curves in along the
 * bottom; one sweeps down the right, the other down the left. A blurred
 * copy of each stroke sits behind it to give the line a soft glow.
 *
 * The path is measured against the live element size (via ResizeObserver)
 * so the bottom corners stay perfectly round at any aspect ratio, and the
 * draw animation is geometry-independent because each path is normalised
 * with `pathLength={1}` — dash maths never has to know the real length.
 *
 * The glow path is inset further than the crisp line so it blooms inwards
 * and only a faint tail reaches the card edge — that avoids a bright,
 * hard-clipped edge appearing as a second line against the border. Its
 * bottom stays close to the line so the glow reaches the bottom edge
 * rather than floating above it. The two halves overlap slightly past the
 * centre so they always meet with no sub-pixel gap.
 *
 * The crisp line uses the true accent gradient (`--template-accent-*`).
 * The glow uses a lightened copy of those colours so the darker end of
 * the gradient (e.g. blue) still blooms as wide as the lighter end on the
 * dark card, instead of reading thinner.
 */
import type { CSSProperties } from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

type CardBorderTraceProps = {
  /** When true the snake draws in; when false it retracts back to the start. */
  active: boolean;
  /** Accent colours (start, middle, end) used to brighten the glow. */
  colors?: readonly [string, string, string];
  /** Bottom corner radius in px for the crisp line; match the card radius. */
  radius?: number;
  /** Crisp line width in px. */
  strokeWidth?: number;
  /** Draw / retract duration in ms. */
  durationMs?: number;
  className?: string;
};

// How far each half runs past the centre so the two ends always overlap.
const CENTRE_OVERLAP = 1.5;
// The glow is inset inwards on the sides so its bright core blooms inside
// the card and only a faint tail reaches the edge. Its bottom stays close
// to the crisp line so the glow reaches the bottom edge.
const GLOW_INSET_X = 8;
const GLOW_INSET_BOTTOM = 2;
// How far the glow colours are lifted towards white so darker accents glow
// as brightly (and therefore as wide) as lighter ones.
const GLOW_LIGHTEN = 0.4;

function lighten(hex: string, amount: number): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return hex;
  const value = parseInt(match[1], 16);
  const mix = (channel: number) => Math.round(channel + (255 - channel) * amount);
  const r = mix((value >> 16) & 0xff);
  const g = mix((value >> 8) & 0xff);
  const b = mix(value & 0xff);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function halfPaths(w: number, h: number, radius: number, insetX: number, insetBottom: number) {
  const left = insetX;
  const right = w - insetX;
  const bottom = h - insetBottom;
  const cx = w / 2;
  const r = Math.max(0, Math.min(radius - insetX, (right - left) / 2, bottom));
  const rightPath = `M ${right} 0 V ${bottom - r} A ${r} ${r} 0 0 1 ${right - r} ${bottom} H ${cx - CENTRE_OVERLAP}`;
  const leftPath = `M ${left} 0 V ${bottom - r} A ${r} ${r} 0 0 0 ${left + r} ${bottom} H ${cx + CENTRE_OVERLAP}`;
  return [rightPath, leftPath];
}

export function CardBorderTrace({
  active,
  colors,
  radius = 10,
  strokeWidth = 4,
  durationMs = 1050,
  className,
}: CardBorderTraceProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [{ w, h }, setSize] = useState({ w: 0, h: 0 });
  const rawId = useId().replace(/:/g, '');
  const lineId = `card-trace-line-${rawId}`;
  const glowId = `card-trace-glow-${rawId}`;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (typeof ResizeObserver === 'undefined') {
      setSize({ w: element.clientWidth, h: element.clientHeight });
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect && rect.width > 0 && rect.height > 0) {
        setSize({ w: rect.width, h: rect.height });
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const ready = w > 0 && h > 0;
  const crispPaths = halfPaths(w, h, radius, 0, 0);
  const glowPaths = halfPaths(w, h, radius, GLOW_INSET_X, GLOW_INSET_BOTTOM);

  const lineStops = [
    'var(--template-accent-start)',
    'var(--template-accent-middle)',
    'var(--template-accent-end)',
  ];
  const glowStops = colors ? colors.map((color) => lighten(color, GLOW_LIGHTEN)) : lineStops;

  const dashStyle: CSSProperties = {
    strokeDasharray: 1,
    strokeDashoffset: active ? 0 : 1,
    transition: `stroke-dashoffset ${durationMs}ms cubic-bezier(0.16, 1, 0.3, 1)`,
  };

  return (
    <div ref={ref} aria-hidden className={cn('pointer-events-none absolute inset-0', className)}>
      {ready ? (
        <svg
          className="absolute inset-0 h-full w-full overflow-visible"
          viewBox={`0 0 ${w} ${h}`}
          fill="none"
        >
          <defs>
            <linearGradient id={lineId} x1="0" y1="0" x2={w} y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={lineStops[0]} />
              <stop offset="50%" stopColor={lineStops[1]} />
              <stop offset="100%" stopColor={lineStops[2]} />
            </linearGradient>
            <linearGradient id={glowId} x1="0" y1="0" x2={w} y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={glowStops[0]} />
              <stop offset="50%" stopColor={glowStops[1]} />
              <stop offset="100%" stopColor={glowStops[2]} />
            </linearGradient>
          </defs>
          {glowPaths.map((d, index) => (
            <path
              key={`glow-${index}`}
              d={d}
              pathLength={1}
              stroke={`url(#${glowId})`}
              strokeWidth={strokeWidth * 3.25}
              strokeLinecap="butt"
              style={dashStyle}
              className="opacity-70 [filter:blur(7px)] motion-reduce:transition-none"
            />
          ))}
          {crispPaths.map((d, index) => (
            <path
              key={`line-${index}`}
              d={d}
              pathLength={1}
              stroke={`url(#${lineId})`}
              strokeWidth={strokeWidth}
              strokeLinecap="butt"
              style={dashStyle}
              className="motion-reduce:transition-none"
            />
          ))}
        </svg>
      ) : null}
    </div>
  );
}
