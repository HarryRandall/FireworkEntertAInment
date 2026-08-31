/**
 * Landing-page decorative primitives — the hand-drawn, type-forward
 * marketing language: marker highlights, twinkling sparkles, doodle
 * illustrations, initials avatars, and the per-show palette pieces.
 * Pure presentational components shared across the landing sections.
 */
import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';

/* ---------- Eyebrow (small uppercase label above section titles) ---------- */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="text-on-surface-variant block text-xs font-semibold tracking-[0.18em] uppercase">
      {children}
    </span>
  );
}

/* ---------- Marker highlight behind a word ('look here') ---------- */
export function Mark({ children }: { children: ReactNode }) {
  return (
    <span className="lp-mark">
      <span>{children}</span>
    </span>
  );
}

/* ---------- Hand-drawn sparkle twinkle (outline, theme-aware) ---------- */
export function Sparkle({
  size = 22,
  color = 'var(--hl)',
  fill = false,
  float = true,
  style,
}: {
  size?: number;
  color?: string;
  fill?: boolean;
  float?: boolean;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={float ? 'lp-spark-float' : undefined}
      fill={fill ? color : 'none'}
      stroke={color}
      strokeWidth={fill ? 0 : 1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'block', ...style }}
      aria-hidden="true"
    >
      {/* loose four-point twinkle, drawn like a marker spark */}
      <path d="M12 2.5c.7 5.4 2 6.9 7.6 9.3-5.6 2.4-6.9 3.9-7.6 9.7-.7-5.8-2-7.3-7.6-9.7C10 9.4 11.3 7.9 12 2.5Z" />
    </svg>
  );
}

/* ---------- Small scattered spark (a twinkle with a companion dot) ---------- */
export function Star4({
  size = 18,
  color = 'var(--hl)',
  float = true,
  className,
  style,
}: {
  size?: number;
  color?: string;
  float?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={
        [float ? 'lp-spark-float' : null, className].filter(Boolean).join(' ') || undefined
      }
      fill="none"
      stroke={color}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'block', ...style }}
      aria-hidden="true"
    >
      <path d="M10 2.6c.6 4.6 1.7 5.9 6.4 7.9-4.7 2-5.8 3.3-6.4 8.2-.6-4.9-1.7-6.2-6.4-8.2C8.3 8.5 9.4 7.2 10 2.6Z" />
      <circle cx="19" cy="19" r="1.4" fill={color} stroke="none" />
    </svg>
  );
}

/* ---------- Hand-drawn underline flourish (beneath a caption) ---------- */
export function Underline({
  width = 128,
  color = 'var(--hl)',
  className,
  style,
}: {
  width?: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={width}
      height={Math.round(width * (20 / 56))}
      viewBox="0 0 56 20"
      fill="none"
      stroke={color}
      strokeWidth={1.2}
      strokeLinecap="round"
      className={className}
      style={{ display: 'block', ...style }}
      aria-hidden="true"
    >
      <path d="M0.599976 0.702914C0.679983 0.702914 0.759992 0.702914 8.86798 0.669386C16.976 0.635858 33.1095 0.568802 41.88 0.61662C50.6505 0.664439 51.569 0.829163 53.0298 1.25805C54.4907 1.68693 56.466 2.37498 50.8974 2.74474C45.3288 3.1145 32.1565 3.14511 25.1885 3.22867C18.2206 3.31222 17.8563 3.44779 17.9477 3.7352C18.308 4.8675 21.0602 5.0635 23.6511 5.57791C24.2339 5.69363 20.735 7.90863 16.9126 9.5422C15.5754 10.1137 15.6274 11.003 15.812 11.88C15.9966 12.7569 16.3546 13.8094 16.4249 14.7926C16.4952 15.7757 16.2669 16.6576 15.6879 18.6" />
    </svg>
  );
}

/* ---------- Avatar (initials) ---------- */
export function Avatar({ name, tone = 'var(--show-gold)' }: { name: string; tone?: string }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('');
  return (
    <span
      className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
      style={{
        background: `linear-gradient(135deg, color-mix(in srgb, ${tone} 70%, black), ${tone})`,
      }}
    >
      {initials}
    </span>
  );
}

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

/* ---------- Show card (community gallery tile) ---------- */
function HeartIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 21s-7.5-4.6-10-9.2C.4 8.9 1.7 5 5.2 5c2 0 3.3 1.1 4 2.2C9.9 6.1 11.2 5 13.2 5c3.5 0 4.8 3.9 3.2 6.8C19.5 16.4 12 21 12 21z" />
    </svg>
  );
}

export function ShowCard({
  title,
  theme,
  palette,
  likes,
  budget,
  action,
  href,
}: {
  title: string;
  theme: string;
  palette: string[];
  likes?: number;
  budget?: string;
  action?: string;
  href: string;
}) {
  const gradient = `linear-gradient(135deg, color-mix(in srgb, ${palette[0]} 58%, black), ${palette[0]}, ${palette[2]})`;
  return (
    <Link
      href={href}
      className="border-outline-variant/60 bg-card focus-visible:ring-primary/45 focus-visible:ring-offset-background flex min-h-40 touch-manipulation flex-col overflow-hidden rounded-2xl border no-underline shadow-[var(--shadow-card)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <div
        className="border-outline-variant/60 relative h-20 flex-shrink-0 border-b"
        style={{ background: gradient }}
      >
        {(likes != null || budget != null) && (
          <div className="absolute top-2 right-2 flex flex-col items-end gap-px rounded-lg bg-black/35 px-2 py-1 text-[11px] leading-4 text-white backdrop-blur-sm">
            {likes != null && (
              <span className="inline-flex items-center gap-1">
                <span className="inline-flex text-[var(--show-rose)]">
                  <HeartIcon />
                </span>
                <span className="tabular-nums">{likes}</span>
              </span>
            )}
            {budget != null && <span className="tabular-nums">{budget}</span>}
          </div>
        )}
        <div className="absolute bottom-2 left-2.5">
          <PaletteDots palette={palette} />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-3.5">
        <div className="min-w-0">
          <h3 className="text-on-surface truncate text-sm font-semibold">{title}</h3>
          {theme && <p className="text-on-surface-variant mt-1 truncate text-xs">{theme}</p>}
        </div>
        {action && (
          <span className="border-outline-variant/60 text-on-surface inline-flex h-7 items-center self-start rounded-lg border px-2.5 text-xs font-medium">
            {action}
          </span>
        )}
      </div>
    </Link>
  );
}
