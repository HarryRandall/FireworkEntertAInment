"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { Container } from "@/app/components/ui/Container";
import { Reveal } from "./Reveal";

// Pins use the same 959 x 593 viewBox as the underlying USA map SVG so they
// line up with real city locations (Albers projection).
// Coordinates are tuned to sit inland on the 959x593 USA map SVG.
const VENDOR_PINS: { x: number; y: number; size: "lg" | "md" | "sm"; label?: string }[] = [
  { x: 805, y: 195, size: "lg", label: "New York" },
  { x: 125, y: 320, size: "lg", label: "Los Angeles" },
  { x: 605, y: 230, size: "lg", label: "Chicago" },
  { x: 525, y: 445, size: "md", label: "Houston" },
  { x: 768, y: 480, size: "md", label: "Miami" },
  { x: 165, y: 110, size: "md", label: "Seattle" },
  { x: 370, y: 285, size: "md", label: "Denver" },
  { x: 685, y: 380, size: "md", label: "Atlanta" },
  { x: 245, y: 380, size: "sm", label: "Phoenix" },
  { x: 780, y: 250, size: "sm" }, // DC
  { x: 505, y: 415, size: "sm" }, // Dallas
  { x: 835, y: 180, size: "sm" }, // Boston
  { x: 220, y: 220, size: "sm" }, // Salt Lake City
  { x: 485, y: 320, size: "sm" }, // Kansas City
  { x: 615, y: 350, size: "sm" }, // Memphis
  { x: 690, y: 245, size: "sm" }, // Detroit
];

// Random "current user" location — Austin, TX area on the 959x593 map.
const USER_LOCATION = { x: 488, y: 462 };
// Highlight the closest vendor so the user sees who'd ship to them.
const NEAREST_VENDOR = { x: 525, y: 445 }; // Houston

const STATS = [
  { value: "342", label: "Products in vendor catalogue", accent: "primary" as const },
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
                {/* Connector from user location to nearest vendor */}
                <line
                  x1={USER_LOCATION.x}
                  y1={USER_LOCATION.y}
                  x2={NEAREST_VENDOR.x}
                  y2={NEAREST_VENDOR.y}
                  stroke="#22c55e"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  opacity="0.7"
                />

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

                {/* Current user location */}
                <g>
                  {!reduce ? (
                    <circle
                      cx={USER_LOCATION.x}
                      cy={USER_LOCATION.y}
                      r={5}
                      fill="none"
                      stroke="#22c55e"
                      strokeWidth="1.5"
                      opacity="0.8"
                    >
                      <animate
                        attributeName="r"
                        values="5;20;20"
                        dur="2.4s"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="opacity"
                        values="0.8;0;0"
                        dur="2.4s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  ) : null}
                  <circle
                    cx={USER_LOCATION.x}
                    cy={USER_LOCATION.y}
                    r={5}
                    fill="#22c55e"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                    style={{ filter: "drop-shadow(0 0 12px #22c55e)" }}
                  />
                </g>
              </svg>

              {/* Floating chips */}
              <div className="absolute right-3 top-3 hidden rounded-xl border border-outline-variant/40 bg-surface-container px-4 py-3 shadow-[var(--shadow-card)] backdrop-blur-md md:block">
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
                  342 products
                </div>
              </div>

              <div className="absolute bottom-3 left-3 hidden rounded-xl border border-outline-variant/40 bg-surface-container px-4 py-3 shadow-[var(--shadow-card)] backdrop-blur-md md:block">
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
              className="rounded-2xl border border-outline-variant/40 bg-surface-container-high p-6 shadow-[var(--shadow-card)] backdrop-blur-sm"
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
