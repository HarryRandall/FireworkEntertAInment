"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Container } from "@/app/components/ui/Container";
import { Reveal } from "./Reveal";

// USA SVG viewBox: 0 0 1000 600.
// Pin coordinates are hand-tuned to the simplified outline below — they only
// need to look right, not be cartographically perfect.
const VENDOR_PINS: { x: number; y: number; size: "lg" | "md" | "sm"; label?: string }[] = [
  { x: 870, y: 230, size: "lg", label: "New York" },   // NYC
  { x: 110, y: 280, size: "lg", label: "Los Angeles" }, // LA
  { x: 600, y: 235, size: "lg", label: "Chicago" },     // Chicago
  { x: 540, y: 430, size: "md", label: "Houston" },     // Houston
  { x: 855, y: 470, size: "md", label: "Miami" },       // Miami
  { x: 130, y: 175, size: "md", label: "Seattle" },     // Seattle
  { x: 350, y: 280, size: "md", label: "Denver" },      // Denver
  { x: 740, y: 360, size: "md", label: "Atlanta" },     // Atlanta
  { x: 245, y: 365, size: "sm", label: "Phoenix" },     // Phoenix
  { x: 720, y: 250, size: "sm" },                       // Detroit-ish
  { x: 460, y: 320, size: "sm" },                       // Kansas City-ish
  { x: 800, y: 295, size: "sm" },                       // DC-ish
  { x: 415, y: 410, size: "sm" },                       // Dallas-ish
  { x: 200, y: 230, size: "sm" },                       // Salt Lake-ish
  { x: 660, y: 410, size: "sm" },                       // Memphis-ish
];

const STATS = [
  { value: "342", label: "SKUs in vendor catalogue", accent: "primary" as const },
  { value: "48", label: "Cities with same-day pickup", accent: "primary" as const },
  { value: "96%", label: "Beat-sync accuracy", accent: "tertiary" as const },
  { value: "<3 min", label: "Average design time", accent: "primary" as const },
];

export function VendorNetwork() {
  const reduce = useReducedMotion();

  return (
    <section className="relative overflow-hidden bg-background py-24 lg:py-32">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_30%,color-mix(in_srgb,var(--color-primary)_18%,transparent),transparent_55%)]"
      />

      <Container>
        <Reveal className="mx-auto mb-14 max-w-3xl space-y-3 text-center md:mb-16">
          <span className="block text-xs font-bold uppercase tracking-[0.2em] text-primary">
            Built for your zip code
          </span>
          <h2 className="text-4xl font-bold tracking-tight text-on-surface md:text-6xl">
            One nationwide vendor network{" "}
            <span className="bg-gradient-to-br from-primary-fixed via-primary to-primary-container bg-clip-text text-transparent">
              you can actually buy from.
            </span>
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-on-surface-variant">
            Every shell in your show is a real product on a real shelf, priced
            to your local store. We sync inventory live from ICON Pyrotechnics
            and partner retailers across the United States.
          </p>
        </Reveal>

        {/* Map first — large and centred — then stats below in a clean row. */}
        <Reveal>
          <div className="relative mx-auto w-full max-w-5xl">
            <div className="relative aspect-[5/3] w-full">
              <svg
                viewBox="0 0 1000 600"
                xmlns="http://www.w3.org/2000/svg"
                className="absolute inset-0 h-full w-full"
                aria-hidden
              >
                <defs>
                  <radialGradient id="usGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.32" />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
                  </radialGradient>
                  <linearGradient id="usFill" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="color-mix(in srgb, var(--color-primary) 35%, var(--color-surface-container-high))" />
                    <stop offset="100%" stopColor="var(--color-surface-container)" />
                  </linearGradient>
                </defs>

                {/* Halo behind map */}
                <ellipse cx="500" cy="320" rx="430" ry="240" fill="url(#usGlow)" />

                {/* Stylised contiguous USA — simplified hand-drawn outline. */}
                <path
                  d="M95 175
                     L155 145 L210 135 L275 130 L340 125 L405 130 L470 130 L530 125 L595 125 L655 130 L720 135 L780 140 L835 150 L880 165 L915 185 L935 215
                     L920 245 L905 270 L905 295 L915 315 L900 330
                     L880 355 L860 375 L880 400 L885 430 L870 460 L845 485 L815 495 L785 490
                     L750 485 L715 490 L680 495 L645 490 L610 485 L575 490 L540 495 L505 495 L470 495 L440 485 L415 470 L385 460 L355 470 L325 480 L295 470 L265 450 L240 425
                     L215 395 L195 365 L175 335 L155 305 L135 275 L120 245 L105 215 Z"
                  fill="url(#usFill)"
                  stroke="color-mix(in srgb, var(--color-primary) 45%, transparent)"
                  strokeWidth="1.75"
                  strokeLinejoin="round"
                />

                {/* Florida tail */}
                <path
                  d="M810 410 L830 440 L848 475 L860 500 L850 510 L835 495 L815 470 L800 445 Z"
                  fill="url(#usFill)"
                  stroke="color-mix(in srgb, var(--color-primary) 45%, transparent)"
                  strokeWidth="1.75"
                  strokeLinejoin="round"
                />

                {/* Texas dip */}
                <path
                  d="M455 460 L470 490 L490 510 L515 510 L530 490 L545 465 Z"
                  fill="url(#usFill)"
                  stroke="color-mix(in srgb, var(--color-primary) 45%, transparent)"
                  strokeWidth="1.75"
                  strokeLinejoin="round"
                />

                {/* Vendor pins */}
                {VENDOR_PINS.map((p, i) => {
                  const r = p.size === "lg" ? 7 : p.size === "md" ? 5 : 3.2;
                  const ringR = p.size === "lg" ? 24 : p.size === "md" ? 17 : 11;
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
              <div className="absolute right-3 top-3 hidden rounded-xl border border-outline-variant/20 bg-surface-container/70 px-4 py-3 backdrop-blur-md md:block">
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
              <div className="absolute bottom-3 left-3 hidden rounded-xl border border-outline-variant/20 bg-surface-container/70 px-4 py-3 backdrop-blur-md md:block">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                  Nearest store
                </div>
                <div className="mt-1 font-mono text-sm font-bold tabular-nums text-on-surface">
                  ICON · Austin · 4.2 mi
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Stat row — sits below the map, full-width and balanced. */}
        <div className="mt-14 grid grid-cols-2 gap-4 md:mt-16 md:grid-cols-4 md:gap-6">
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10% 0px" }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-2xl border border-outline-variant/15 bg-surface-container-low/70 p-6 backdrop-blur-sm"
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
      </Container>
    </section>
  );
}
