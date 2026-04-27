"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { Container } from "@/app/components/ui/Container";
import { Reveal } from "./Reveal";

// Pins use the same 959 x 593 viewBox as the underlying USA map SVG so they
// line up with real city locations (Albers projection).
const VENDOR_PINS: { x: number; y: number; size: "lg" | "md" | "sm"; label?: string }[] = [
  { x: 810, y: 175, size: "lg", label: "New York" },
  { x: 120, y: 350, size: "lg", label: "Los Angeles" },
  { x: 615, y: 215, size: "lg", label: "Chicago" },
  { x: 545, y: 460, size: "md", label: "Houston" },
  { x: 810, y: 510, size: "md", label: "Miami" },
  { x: 140, y: 90, size: "md", label: "Seattle" },
  { x: 370, y: 285, size: "md", label: "Denver" },
  { x: 700, y: 395, size: "md", label: "Atlanta" },
  { x: 245, y: 395, size: "sm", label: "Phoenix" },
  { x: 795, y: 245, size: "sm" }, // DC
  { x: 510, y: 430, size: "sm" }, // Dallas
  { x: 860, y: 175, size: "sm" }, // Boston
  { x: 190, y: 195, size: "sm" }, // Salt Lake-ish
  { x: 480, y: 350, size: "sm" }, // Kansas City-ish
  { x: 660, y: 360, size: "sm" }, // Memphis-ish
  { x: 700, y: 250, size: "sm" }, // Detroit-ish
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

        <Reveal>
          <div className="relative mx-auto w-full max-w-5xl">
            <div className="relative aspect-[959/593] w-full">
              {/* Base map */}
              <Image
                src="/images/landing/us-map.svg"
                alt="Map of the United States"
                fill
                priority={false}
                className="select-none object-contain"
                sizes="(min-width: 1024px) 1024px, 100vw"
              />

              {/* Pins overlay — same viewBox as the map for 1:1 alignment */}
              <svg
                viewBox="0 0 959 593"
                xmlns="http://www.w3.org/2000/svg"
                className="absolute inset-0 h-full w-full"
                aria-hidden
              >
                {VENDOR_PINS.map((p, i) => {
                  const r = p.size === "lg" ? 6 : p.size === "md" ? 4.5 : 3;
                  const ringR = p.size === "lg" ? 22 : p.size === "md" ? 16 : 11;
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
                          opacity="0.7"
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
                            values="0.7;0;0"
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
                          filter: `drop-shadow(0 0 ${r * 2.4}px var(--color-primary))`,
                        }}
                      />
                    </g>
                  );
                })}
              </svg>

              {/* Floating chips */}
              <div className="absolute right-3 top-3 hidden rounded-xl border border-outline-variant/20 bg-surface-container/80 px-4 py-3 backdrop-blur-md md:block">
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

              <div className="absolute bottom-3 left-3 hidden rounded-xl border border-outline-variant/20 bg-surface-container/80 px-4 py-3 backdrop-blur-md md:block">
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
