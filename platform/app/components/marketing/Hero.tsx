'use client';

/**
 * Hero - full-bleed hero section on the public landing page. Lazy-
 * loads HeroCanvas (`ssr: false`) for the WebGL background and falls
 * back to a static gradient when reduced motion is preferred.
 */
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { PlayCircle, Sparkles } from 'lucide-react';
import { Container } from '@/app/components/ui/Container';
import { Button } from '@/app/components/ui/Button';

const HeroCanvas = dynamic(() => import('./HeroCanvas'), {
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
    <section className="bg-background relative isolate overflow-hidden pt-28 pb-20 lg:pt-36 lg:pb-28">
      {/* WebGL canvas - full-bleed behind the copy. */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        {showCanvas ? <HeroCanvas /> : null}
        {/* Vignette + base gradient - paints before R3F mounts and softens edges. */}
        <div className="hero-rainbow-wash absolute top-[44%] left-1/2 h-[34rem] w-[min(82rem,112vw)] -translate-x-1/2 -translate-y-1/2" />
        <div aria-hidden className="noise-overlay" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,var(--color-background)_75%)]" />
        <div className="from-background absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t to-transparent" />
      </div>

      <Container className="relative z-10 flex flex-col items-center text-center">
        <motion.div
          {...fadeUp(0)}
          className="border-outline-variant/30 bg-surface-container/40 text-primary mb-8 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-bold tracking-[0.18em] uppercase backdrop-blur-md"
        >
          <Sparkles size={14} strokeWidth={2} />
          AI choreography · powered by ICON Pyrotechnics
        </motion.div>

        <motion.h1
          {...fadeUp(0.05)}
          className="text-on-surface max-w-5xl text-5xl leading-[1.02] font-extrabold tracking-tight md:text-7xl lg:text-[88px]"
        >
          {title} <span>{highlight}</span>
        </motion.h1>

        <motion.p
          {...fadeUp(0.15)}
          className="text-on-surface-variant mt-8 max-w-2xl text-lg leading-relaxed md:text-xl"
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
