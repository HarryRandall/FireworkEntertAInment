/** Global 404 page rendered when no route matches. */

import { Home } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { Container } from '@/app/components/ui/Container';

export default function NotFound() {
  return (
    <div className="bg-background relative flex min-h-screen flex-col items-center justify-center overflow-hidden">
      {/* Neon glow backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <div className="bg-primary/10 h-[600px] w-[600px] rounded-full blur-[140px]" />
      </div>

      {/* Floating sparks */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {[
          { top: '18%', left: '12%', size: 3, opacity: 0.35 },
          { top: '72%', left: '8%', size: 2, opacity: 0.25 },
          { top: '35%', left: '88%', size: 4, opacity: 0.3 },
          { top: '80%', left: '82%', size: 2, opacity: 0.2 },
          { top: '55%', left: '50%', size: 3, opacity: 0.15 },
          { top: '10%', left: '60%', size: 2, opacity: 0.25 },
        ].map((spark, i) => (
          <span
            key={i}
            className="bg-primary absolute animate-pulse rounded-full"
            style={{
              top: spark.top,
              left: spark.left,
              width: spark.size,
              height: spark.size,
              opacity: spark.opacity,
              animationDelay: `${i * 0.4}s`,
              animationDuration: `${2.5 + i * 0.3}s`,
            }}
          />
        ))}
      </div>

      <Container className="relative z-10 flex flex-col items-center gap-8 py-24 text-center">
        {/* Eyebrow */}
        <p className="text-on-surface-variant text-xs font-bold tracking-widest uppercase">
          Error 404
        </p>

        {/* Headline */}
        <div className="flex flex-col gap-3">
          <h1 className="text-on-surface text-[clamp(72px,14vw,140px)] leading-none font-extrabold tracking-tighter tabular-nums select-none">
            4<span className="text-primary">0</span>4
          </h1>
          <p className="text-on-surface text-xl leading-snug font-semibold md:text-2xl">
            This shell misfired.
          </p>
        </div>

        {/* Body */}
        <p className="text-on-surface-variant max-w-md text-base leading-relaxed">
          The page you're looking for doesn't exist — or it's been moved to a different part of the
          show. Head back and pick up where you left off.
        </p>

        <Button href="/" size="lg">
          <Home size={18} strokeWidth={1.75} />
          Return Home
        </Button>
      </Container>
    </div>
  );
}
