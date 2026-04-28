"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { PlayCircle, Sparkles } from "lucide-react";
import { Container } from "@/app/components/ui/Container";
import { Button } from "@/app/components/ui/Button";

const HeroCanvas = dynamic(() => import("./HeroCanvas"), {
  ssr: false,
  loading: () => null,
});

type HeroProps = {
  title: string;
  highlight: string;
  subtitle: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

export function Hero({
  title,
  highlight,
  subtitle,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: HeroProps) {
  const reduce = useReducedMotion();
  const [showCanvas, setShowCanvas] = useState(false);

  useEffect(() => {
    if (reduce) {
      setShowCanvas(false);
      return;
    }

    const scheduleCanvas = () => setShowCanvas(true);
    const idleId = window.requestIdleCallback?.(scheduleCanvas, {
      timeout: 1200,
    });
    const timeoutId = idleId ? undefined : window.setTimeout(scheduleCanvas, 250);

    return () => {
      if (idleId) window.cancelIdleCallback?.(idleId);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [reduce]);

  const fadeUp = (delay = 0) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 24 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] as const },
        };

  return (
    <section className="relative isolate overflow-hidden bg-background pb-20 pt-28 lg:pb-28 lg:pt-36">
      {/* WebGL canvas — full-bleed behind the copy. */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        {showCanvas ? <HeroCanvas /> : null}
        {/* Vignette + base gradient — paints before R3F mounts and softens edges. */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,var(--color-background)_75%)]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />
        <div className="hero-glow absolute left-1/2 top-1/2 h-[720px] w-[720px] -translate-x-1/2 -translate-y-1/2" />
      </div>

      <Container className="relative z-10 flex flex-col items-center text-center">
        <motion.div
          {...fadeUp(0)}
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-outline-variant/30 bg-surface-container/40 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-primary backdrop-blur-md"
        >
          <Sparkles size={14} strokeWidth={2} />
          AI choreography · powered by ICON Pyrotechnics
        </motion.div>

        <motion.h1
          {...fadeUp(0.05)}
          className="max-w-5xl text-5xl font-extrabold leading-[1.02] tracking-tight text-on-surface md:text-7xl lg:text-[88px]"
        >
          {title}{" "}
          <span className="relative inline-block">
            <span className="bg-gradient-to-br from-primary-fixed via-primary to-primary-container bg-clip-text text-transparent">
              {highlight}
            </span>
            <span
              aria-hidden
              className="absolute inset-x-0 -bottom-2 h-3 -z-10 rounded-full bg-primary/30 blur-2xl"
            />
          </span>
        </motion.h1>

        <motion.p
          {...fadeUp(0.15)}
          className="mt-8 max-w-2xl text-lg leading-relaxed text-on-surface-variant md:text-xl"
        >
          {subtitle}
        </motion.p>

        <motion.div
          {...fadeUp(0.25)}
          className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <Button href={primaryHref} size="lg">
            {primaryLabel}
          </Button>
          {secondaryHref ? (
            <Button href={secondaryHref} size="lg" variant="secondary">
              {secondaryLabel}
              <PlayCircle size={20} />
            </Button>
          ) : null}
        </motion.div>
      </Container>
    </section>
  );
}
