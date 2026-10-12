/** Show palette dots and the energy waveform drawn over the landing sky's controls. */
import type { CSSProperties } from 'react';

/* ---------- Palette dots ---------- */
export function PaletteDots({ palette }: { palette: string[] }) {
  return (
    <span className="inline-flex items-center gap-1.5" aria-label="Show palette">
      {palette.map((c, i) => (
        <span
          key={i}
          className="h-2.5 w-2.5 rounded-full shadow-[0_0_0_1px_rgba(255,255,255,0.18)_inset]"
          style={{ backgroundColor: c }}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

/* ---------- Energy waveform (show energy over time) ---------- */
export function EnergyWaveform({
  values,
  palette = ['var(--show-gold)', 'var(--show-green)', 'var(--show-violet)'],
  height = 44,
  className,
  style,
}: {
  values?: number[];
  palette?: string[];
  height?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const buckets =
    values && values.length
      ? values
      : Array.from(
          { length: 48 },
          (_, i) => 0.25 + 0.7 * Math.abs(Math.sin((i / 48) * Math.PI * 3)),
        );
  const barWidth = 3.5;
  const gap = 2.25;
  const width = buckets.length * (barWidth + gap);
  return (
    <svg
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Show energy preview"
      style={{ width: '100%', height, overflow: 'visible', ...style }}
    >
      {buckets.map((value, index) => {
        const clamped = Math.max(0.08, Math.min(1, value));
        // Round to avoid server/client floating-point drift in Math.sin output,
        // which otherwise causes hydration attribute mismatches.
        const barHeight = Math.round((5 + clamped * (height - 7)) * 100) / 100;
        const isFinale = index > buckets.length * 0.82;
        const fill =
          isFinale || clamped > 0.68
            ? palette[2]
            : clamped > 0.38
              ? palette[0]
              : 'var(--color-content-muted)';
        return (
          <rect
            key={index}
            x={index * (barWidth + gap)}
            y={height - barHeight}
            width={barWidth}
            height={barHeight}
            rx={1.75}
            fill={fill}
            opacity={clamped > 0.38 ? 0.92 : 0.55}
          />
        );
      })}
    </svg>
  );
}
