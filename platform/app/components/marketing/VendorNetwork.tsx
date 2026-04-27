"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Container } from "@/app/components/ui/Container";
import { Reveal } from "./Reveal";

// Approximate (x, y) percentages over the SVG viewBox of major AU cities.
// viewBox = 0 0 800 700.
const VENDOR_PINS: { x: number; y: number; size: "lg" | "md" | "sm"; label?: string }[] = [
  { x: 700, y: 470, size: "lg", label: "Sydney" },
  { x: 615, y: 555, size: "lg", label: "Melbourne" },
  { x: 695, y: 380, size: "md", label: "Brisbane" },
  { x: 230, y: 415, size: "md", label: "Perth" },
  { x: 545, y: 555, size: "md", label: "Adelaide" },
  { x: 600, y: 645, size: "sm", label: "Hobart" },
  { x: 555, y: 250, size: "sm", label: "Darwin" },
  { x: 460, y: 460, size: "sm" },
  { x: 660, y: 510, size: "sm" },
  { x: 380, y: 380, size: "sm" },
  { x: 480, y: 600, size: "sm" },
  { x: 740, y: 430, size: "sm" },
  { x: 320, y: 470, size: "sm" },
];

const STATS = [
  { value: "342", label: "SKUs in vendor catalogue", accent: "primary" as const },
  { value: "18", label: "Cities with same-day pickup", accent: "primary" as const },
  { value: "96%", label: "Beat-sync accuracy", accent: "tertiary" as const },
  { value: "<3 min", label: "Average design time", accent: "primary" as const },
];

export function VendorNetwork() {
  const reduce = useReducedMotion();

  return (
    <section className="relative overflow-hidden bg-background py-24 lg:py-32">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_30%,color-mix(in_srgb,var(--color-primary)_20%,transparent),transparent_55%)]"
      />

      <Container>
        <Reveal className="mx-auto mb-14 max-w-3xl space-y-3 text-center md:mb-16">
          <span className="block text-xs font-bold uppercase tracking-[0.2em] text-primary">
            Built for your postcode
          </span>
          <h2 className="text-4xl font-bold tracking-tight text-on-surface md:text-6xl">
            One country-wide vendor network{" "}
            <span className="bg-gradient-to-br from-primary-fixed via-primary to-primary-container bg-clip-text text-transparent">
              you can actually buy from.
            </span>
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-on-surface-variant">
            Every shell in your show is a real product on a real shelf, priced
            to your local store. We update inventory live from ICON Pyrotechnics
            and partner retailers across Australia.
          </p>
        </Reveal>

        <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
          {/* Left: stats */}
          <div className="grid grid-cols-2 gap-4 lg:col-span-5">
            {STATS.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-10% 0px" }}
                transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-2xl border border-outline-variant/15 bg-surface-container-low/70 p-5 backdrop-blur-sm"
              >
                <div
                  className={
                    "font-mono text-4xl font-extrabold tabular-nums tracking-tight md:text-5xl " +
                    (s.accent === "tertiary"
                      ? "text-tertiary"
                      : "bg-gradient-to-br from-primary-fixed via-primary to-primary-container bg-clip-text text-transparent")
                  }
                >
                  {s.value}
                </div>
                <div className="mt-2 text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/80">
                  {s.label}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Right: stylised AU map */}
          <div className="relative lg:col-span-7">
            <div className="relative aspect-[8/7] w-full">
              <svg
                viewBox="0 0 800 700"
                xmlns="http://www.w3.org/2000/svg"
                className="absolute inset-0 h-full w-full"
                aria-hidden
              >
                <defs>
                  <radialGradient id="auGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
                  </radialGradient>
                  <linearGradient id="auFill" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="color-mix(in srgb, var(--color-primary) 30%, var(--color-surface-container-high))" />
                    <stop offset="100%" stopColor="var(--color-surface-container)" />
                  </linearGradient>
                </defs>

                {/* Halo behind map */}
                <circle cx="500" cy="450" r="320" fill="url(#auGlow)" />

                {/* Stylised Australia silhouette (hand-drawn approx). */}
                <path
                  d="M210 400 Q160 380 140 420 Q120 470 160 520 Q200 555 240 540 L260 555 L270 590 L320 615 L370 635 L430 645 L500 660 L555 645 L590 660 L615 645 L630 615 L660 590 L685 600 L710 580 L735 545 L745 505 L760 465 L760 420 L740 380 L725 345 L705 310 L690 280 L660 255 L625 240 L590 230 L555 235 L520 225 L485 215 L450 215 L415 230 L380 245 L345 260 L320 295 L295 320 L270 345 L240 365 Z"
                  fill="url(#auFill)"
                  stroke="color-mix(in srgb, var(--color-primary) 40%, transparent)"
                  strokeWidth="2"
                />

                {/* Tasmania */}
                <ellipse
                  cx="600"
                  cy="650"
                  rx="22"
                  ry="14"
                  fill="url(#auFill)"
                  stroke="color-mix(in srgb, var(--color-primary) 40%, transparent)"
                  strokeWidth="2"
                />

                {/* Vendor pins */}
                {VENDOR_PINS.map((p, i) => {
                  const r =
                    p.size === "lg" ? 7 : p.size === "md" ? 5 : 3.2;
                  const ringR =
                    p.size === "lg" ? 22 : p.size === "md" ? 16 : 11;
                  const delay = (i % 5) * 0.5;
                  return (
                    <g key={i}>
                      {!reduce ? (
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r={ringR}
                          fill="none"
                          stroke="var(--color-primary)"
                          strokeWidth="1.5"
                          opacity="0.6"
                        >
                          <animate
                            attributeName="r"
                            values={`${r};${ringR};${ringR}`}
                            dur="2.4s"
                            begin={`${delay}s`}
                            repeatCount="indefinite"
                          />
                          <animate
                            attributeName="opacity"
                            values="0.6;0;0"
                            dur="2.4s"
                            begin={`${delay}s`}
                            repeatCount="indefinite"
                          />
                        </circle>
                      ) : null}
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={r}
                        fill="var(--color-primary)"
                        style={{
                          filter: `drop-shadow(0 0 ${r * 2}px var(--color-primary))`,
                        }}
                      />
                    </g>
                  );
                })}
              </svg>

              {/* Floating chip — top right */}
              <div className="absolute right-2 top-2 hidden rounded-xl border border-outline-variant/20 bg-surface-container/70 px-4 py-3 backdrop-blur-md md:block">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-tertiary opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-tertiary" />
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-tertiary">
                    Live inventory
                  </span>
                </div>
                <div className="mt-1 font-mono text-sm font-bold tabular-nums text-on-surface">
                  342 SKUs
                </div>
              </div>

              {/* Floating chip — bottom left */}
              <div className="absolute bottom-2 left-2 hidden rounded-xl border border-outline-variant/20 bg-surface-container/70 px-4 py-3 backdrop-blur-md md:block">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                  Nearest store
                </div>
                <div className="mt-1 font-mono text-sm font-bold tabular-nums text-on-surface">
                  ICON · Melbourne · 4.2 km
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
