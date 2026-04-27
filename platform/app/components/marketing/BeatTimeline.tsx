"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Pause, Play } from "lucide-react";
import { Container } from "@/app/components/ui/Container";
import { Reveal } from "./Reveal";

// Pre-baked "song" — beats at fractional positions of the timeline (0..1).
// Mixed: heavy hits get larger shells, off-beats get a small burst.
type Shell = { t: number; size: "sm" | "md" | "lg"; color: "gold" | "sky" };
const SHELLS: Shell[] = [
  { t: 0.04, size: "sm", color: "gold" },
  { t: 0.12, size: "md", color: "gold" },
  { t: 0.2, size: "sm", color: "sky" },
  { t: 0.28, size: "lg", color: "gold" },
  { t: 0.36, size: "sm", color: "gold" },
  { t: 0.44, size: "md", color: "sky" },
  { t: 0.52, size: "sm", color: "gold" },
  { t: 0.6, size: "lg", color: "gold" },
  { t: 0.68, size: "sm", color: "sky" },
  { t: 0.76, size: "md", color: "gold" },
  { t: 0.84, size: "sm", color: "gold" },
  { t: 0.92, size: "lg", color: "gold" },
];

const DURATION_S = 9; // total loop length

export function BeatTimeline() {
  const reduce = useReducedMotion();
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const [bursts, setBursts] = useState<{ id: number; shell: Shell }[]>([]);
  const burstId = useRef(0);
  const lastFiredIdx = useRef<number>(-1);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const offsetRef = useRef<number>(0);

  // Drive playback.
  useEffect(() => {
    if (!playing || reduce) return;
    startRef.current = performance.now() - offsetRef.current * DURATION_S * 1000;
    const tick = (now: number) => {
      const t = ((now - startRef.current) / 1000 / DURATION_S) % 1;
      setProgress(t);
      // Fire any shells whose time we've just crossed.
      SHELLS.forEach((s, i) => {
        const justCrossed =
          (lastFiredIdx.current < i && t >= s.t) ||
          (lastFiredIdx.current > i && t < lastFiredIdx.current && t >= s.t);
        if (justCrossed) {
          lastFiredIdx.current = i;
          const id = burstId.current++;
          setBursts((b) => [...b, { id, shell: s }]);
          window.setTimeout(() => {
            setBursts((b) => b.filter((x) => x.id !== id));
          }, 900);
        }
      });
      // Loop reset
      if (t < 0.02 && lastFiredIdx.current > SHELLS.length - 4) {
        lastFiredIdx.current = -1;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      offsetRef.current = progress;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, reduce]);

  const sizePx = (size: Shell["size"]) =>
    size === "sm" ? 32 : size === "md" ? 56 : 84;

  return (
    <section className="relative bg-background py-20 lg:py-28">
      <Container>
        <Reveal>
          <div className="relative isolate overflow-hidden rounded-3xl border border-outline-variant/20 bg-surface-container-low p-6 md:p-10">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,color-mix(in_srgb,var(--color-primary)_18%,transparent),transparent_60%)]"
            />

            <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                  Live demo
                </span>
                <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                  Press play. Watch every shell hit the beat.
                </h2>
                <p className="max-w-xl text-sm text-on-surface-variant md:text-base">
                  This is a sample of a 9-second pre-chorus from your library —
                  shells trigger on the same beats your audience will feel.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPlaying((p) => !p)}
                className="inline-flex items-center gap-2 self-start rounded-full bg-primary-container px-5 py-2.5 text-sm font-bold text-on-primary-container transition-all hover:brightness-110 active:scale-[0.98]"
                aria-label={playing ? "Pause demo" : "Play demo"}
              >
                {playing ? <Pause size={16} strokeWidth={2.25} /> : <Play size={16} strokeWidth={2.25} />}
                {playing ? "Pause" : "Play demo"}
              </button>
            </div>

            {/* Sky / burst stage */}
            <div className="relative mb-6 h-48 w-full overflow-hidden rounded-2xl bg-gradient-to-b from-[#0a0a14] via-[#0d0e1d] to-[#131323] md:h-64">
              {/* Distant stars */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-50"
                style={{
                  backgroundImage:
                    "radial-gradient(1px 1px at 20% 30%, #fff7, transparent 50%), radial-gradient(1px 1px at 70% 60%, #fff5, transparent 50%), radial-gradient(1px 1px at 40% 80%, #fff6, transparent 50%), radial-gradient(1px 1px at 85% 25%, #fff4, transparent 50%)",
                }}
              />
              {bursts.map(({ id, shell }) => {
                const x = `${shell.t * 100}%`;
                const yPct = shell.size === "lg" ? 25 : shell.size === "md" ? 38 : 52;
                const px = sizePx(shell.size);
                const color =
                  shell.color === "gold" ? "var(--color-primary)" : "var(--color-tertiary)";
                return (
                  <motion.div
                    key={id}
                    className="absolute"
                    style={{ left: x, top: `${yPct}%`, transform: "translate(-50%, -50%)" }}
                    initial={{ opacity: 0, scale: 0.2 }}
                    animate={{ opacity: [0, 1, 0.9, 0], scale: [0.2, 1.1, 1, 0.95] }}
                    transition={{ duration: 0.9, ease: "easeOut" }}
                  >
                    <div
                      className="rounded-full"
                      style={{
                        width: px,
                        height: px,
                        background: `radial-gradient(circle, ${color} 0%, transparent 65%)`,
                        boxShadow: `0 0 ${px * 0.6}px ${color}`,
                      }}
                    />
                  </motion.div>
                );
              })}
              {/* Ground silhouette */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-background to-transparent"
              />
            </div>

            {/* Timeline strip */}
            <div className="relative h-14 w-full select-none rounded-xl border border-outline-variant/15 bg-surface-container-highest/70">
              {/* Beat ticks */}
              {SHELLS.map((s, i) => (
                <div
                  key={i}
                  className="absolute top-2 h-10 w-px bg-outline-variant/30"
                  style={{ left: `${s.t * 100}%` }}
                />
              ))}
              {/* Shell markers */}
              {SHELLS.map((s, i) => {
                const isPast = progress >= s.t;
                const dotSize = s.size === "lg" ? 14 : s.size === "md" ? 10 : 7;
                return (
                  <div
                    key={`m-${i}`}
                    className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors"
                    style={{
                      left: `${s.t * 100}%`,
                      width: dotSize,
                      height: dotSize,
                      background: isPast
                        ? s.color === "gold"
                          ? "var(--color-primary)"
                          : "var(--color-tertiary)"
                        : "var(--color-surface-container)",
                      boxShadow: isPast
                        ? `0 0 12px ${s.color === "gold" ? "var(--color-primary)" : "var(--color-tertiary)"}`
                        : "none",
                      border: "1px solid color-mix(in srgb, var(--color-outline-variant) 30%, transparent)",
                    }}
                  />
                );
              })}
              {/* Playhead */}
              <div
                className="absolute top-0 h-full w-[2px] bg-tertiary shadow-[0_0_10px_var(--color-tertiary)]"
                style={{ left: `${progress * 100}%` }}
              />
              <div className="absolute bottom-1 left-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60">
                00:00
              </div>
              <div className="absolute bottom-1 right-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60">
                00:0{DURATION_S}
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
