"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { Container } from "@/app/components/ui/Container";
import { Reveal } from "./Reveal";

type Stat = {
  value: number;
  suffix?: string;
  prefix?: string;
  label: string;
  decimals?: number;
};

const STATS: Stat[] = [
  { value: 1247, label: "Real SKUs in catalogue", suffix: "+" },
  { value: 96, label: "Beat-sync accuracy", suffix: "%" },
  { value: 2.4, label: "Average design time", suffix: " min", decimals: 1 },
  { value: 18, label: "Local vendors covered" },
];

function CountUp({ to, decimals = 0, duration = 1.6 }: { to: number; decimals?: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? to : 0);

  useEffect(() => {
    if (!inView || reduce) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / (duration * 1000));
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setN(to * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else setN(to);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, duration, reduce]);

  return (
    <span ref={ref} className="font-mono tabular-nums">
      {n.toFixed(decimals)}
    </span>
  );
}

export function StatsStrip() {
  return (
    <section className="relative bg-background py-16 lg:py-20">
      <Container>
        <Reveal>
          <div className="grid grid-cols-2 gap-4 rounded-3xl border border-outline-variant/15 bg-surface-container-low/60 p-6 backdrop-blur-sm md:grid-cols-4 md:gap-6 md:p-10">
            {STATS.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-10% 0px" }}
                transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                className="relative flex flex-col gap-2 px-2 md:border-l md:border-outline-variant/15 md:px-6 md:first:border-l-0"
              >
                <div className="flex items-baseline gap-0.5 text-3xl font-extrabold tracking-tight text-on-surface md:text-5xl">
                  {s.prefix ? <span className="text-on-surface-variant">{s.prefix}</span> : null}
                  <CountUp to={s.value} decimals={s.decimals ?? 0} />
                  {s.suffix ? <span className="text-primary">{s.suffix}</span> : null}
                </div>
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant/70">
                  {s.label}
                </div>
              </motion.div>
            ))}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
