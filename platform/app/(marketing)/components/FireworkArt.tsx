"use client";

import { useEffect, useRef, useState } from "react";

/* ── Firework burst primitive ─────────────────────────────────── */

function FireworkBurst({
  cx, cy, r = 60, color, spokes = 12, delay = "0s",
}: {
  cx: number; cy: number; r?: number; color: string; spokes?: number; delay?: string;
}) {
  const angles = Array.from({ length: spokes }, (_, i) => (i * 360) / spokes);
  return (
    <g transform={`translate(${cx},${cy})`}>
      <circle r={6} fill={color} opacity={0.95}>
        <animate attributeName="r" values="4;10;4" dur="2.4s" begin={delay} repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.95;0.35;0.95" dur="2.4s" begin={delay} repeatCount="indefinite" />
      </circle>
      {angles.map((a) => {
        const rad = (a * Math.PI) / 180;
        const x2 = Math.cos(rad) * r;
        const y2 = Math.sin(rad) * r;
        const xm = Math.cos(rad) * (r * 0.55);
        const ym = Math.sin(rad) * (r * 0.55);
        return (
          <g key={a}>
            <line x1={0} y1={0} x2={x2} y2={y2} stroke={color} strokeWidth={1.5} opacity={0.85}>
              <animate attributeName="opacity" values="0.85;0.25;0.85" dur="2.4s" begin={delay} repeatCount="indefinite" />
            </line>
            <circle cx={xm} cy={ym} r={2} fill={color} opacity={0.95}>
              <animate attributeName="opacity" values="0.95;0.1;0.95" dur="2.4s" begin={delay} repeatCount="indefinite" />
            </circle>
          </g>
        );
      })}
      {angles.filter((_, i) => i % 3 === 0).map((a) => {
        const rad = (a * Math.PI) / 180;
        return (
          <circle key={a} cx={Math.cos(rad) * r} cy={Math.sin(rad) * r} r={3} fill={color} opacity={0.9}>
            <animate attributeName="opacity" values="0.9;0.1;0.9" dur="2.4s" begin={delay} repeatCount="indefinite" />
            <animate attributeName="r" values="3;1.2;3" dur="2.4s" begin={delay} repeatCount="indefinite" />
          </circle>
        );
      })}
    </g>
  );
}

/* ── Art panel ────────────────────────────────────────────────── */

export function FireworkArt() {
  return (
    <div className="relative flex w-full flex-col items-center justify-center gap-6 overflow-hidden p-14">
      <svg viewBox="0 0 420 560" className="w-full max-w-xs" aria-hidden="true">
        <defs>
          <radialGradient id="glow-gold" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffc174" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#ffc174" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="glow-blue" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1abdff" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#1abdff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="glow-sky" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#60b4e0" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#60b4e0" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* ambient glow */}
        <ellipse cx="210" cy="240" rx="130" ry="130" fill="url(#glow-gold)" />
        <ellipse cx="330" cy="140" rx="90" ry="90" fill="url(#glow-blue)" />
        <ellipse cx="100" cy="390" rx="75" ry="75" fill="url(#glow-sky)" />

        {/* trails — more opaque for light mode */}
        <line x1="210" y1="560" x2="210" y2="250" stroke="#ffc174" strokeWidth="2" opacity="0.65" strokeDasharray="6 8">
          <animate attributeName="opacity" values="0.65;0.2;0.65" dur="3s" repeatCount="indefinite" />
        </line>
        <line x1="330" y1="560" x2="330" y2="150" stroke="#1abdff" strokeWidth="1.5" opacity="0.55" strokeDasharray="4 8">
          <animate attributeName="opacity" values="0.55;0.15;0.55" dur="3.5s" repeatCount="indefinite" />
        </line>
        <line x1="100" y1="560" x2="100" y2="390" stroke="#60b4e0" strokeWidth="1.5" opacity="0.55" strokeDasharray="4 8">
          <animate attributeName="opacity" values="0.55;0.15;0.55" dur="2.8s" repeatCount="indefinite" />
        </line>

        {/* bursts — using richer colours */}
        <FireworkBurst cx={210} cy={240} r={90} color="#ffc174" spokes={16} delay="0s" />
        <FireworkBurst cx={330} cy={140} r={60} color="#1abdff" spokes={12} delay="0.6s" />
        <FireworkBurst cx={100} cy={390} r={48} color="#60b4e0" spokes={10} delay="1.2s" />
        <FireworkBurst cx={340} cy={360} r={28} color="#f59e0b" spokes={8} delay="0.9s" />
        <FireworkBurst cx={60} cy={170} r={22} color="#1abdff" spokes={8} delay="1.6s" />

        {/* scattered sparkles */}
        {([[170, 140], [260, 310], [380, 260], [50, 300], [290, 480], [140, 490]] as [number, number][]).map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={2.5} fill="#ffc174" opacity={0.7}>
            <animate attributeName="opacity" values="0.7;0;0.7" dur={`${1.5 + i * 0.4}s`} repeatCount="indefinite" />
          </circle>
        ))}
      </svg>

      <div className="space-y-3 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary/60">ShowCrafter</p>
        <h2 className="text-3xl font-bold leading-tight tracking-tight text-on-surface">
          Design your<br />
          <span className="text-primary">perfect show</span>
        </h2>
        <p className="text-sm text-on-surface-variant leading-relaxed max-w-[220px] mx-auto">
          Professional pyromusical choreography for everyone.
        </p>
      </div>
    </div>
  );
}

/* ── Interactive grid with mouse glow ─────────────────────────── */

const GRID_PATTERN = (
  <defs>
    <pattern id="auth-grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.6" />
    </pattern>
  </defs>
);

export function PageGrid() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mouse, setMouse] = useState({ x: 50, y: 50 });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setMouse({
        x: ((e.clientX - rect.left) / rect.width) * 100,
        y: ((e.clientY - rect.top) / rect.height) * 100,
      });
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  return (
    <div ref={containerRef} className="pointer-events-none fixed inset-0 -z-10" aria-hidden="true">
      {/* Base grid — fades toward edges */}
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.10]"
        style={{
          maskImage: "radial-gradient(ellipse 85% 85% at 50% 50%, black 30%, transparent 100%)",
        }}
        xmlns="http://www.w3.org/2000/svg"
      >
        {GRID_PATTERN}
        <rect width="100%" height="100%" fill="url(#auth-grid)" />
      </svg>

      {/* Spotlight grid — follows mouse, much brighter */}
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.28]"
        style={{
          maskImage: `radial-gradient(circle 220px at ${mouse.x}% ${mouse.y}%, black 0%, transparent 100%)`,
        }}
        xmlns="http://www.w3.org/2000/svg"
      >
        {GRID_PATTERN}
        <rect width="100%" height="100%" fill="url(#auth-grid)" />
      </svg>
    </div>
  );
}
