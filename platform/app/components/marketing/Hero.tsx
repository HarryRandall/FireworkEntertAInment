/** Type-forward landing hero with verified product capabilities beneath the main actions. */
import { ArrowRight, Play } from 'lucide-react';
import { Container } from '@/app/components/ui/Container';
import { Button } from '@/app/components/ui/Button';
import { Reveal } from './Reveal';
import { Doodle } from './landing/Doodle';
import { Mark, Sparkle, Star4 } from './landing/decor';

type HeroProps = {
  title: string;
  highlight: string;
  subtitle: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

const CAPABILITIES = [
  'Music-aware cue planning',
  'Catalogue-backed products',
  'Interactive 3D previews',
] as const;

export function Hero({
  title,
  highlight,
  subtitle,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: HeroProps) {
  return (
    <section className="relative isolate pt-18 pb-20 lg:pt-24">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="hero-rainbow-wash absolute top-[42%] left-1/2 h-[30rem] w-[min(70rem,110vw)] -translate-x-1/2 -translate-y-1/2" />
        <div className="noise-overlay" />
      </div>

      <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden">
        <Doodle
          name="fire"
          width={230}
          bob
          className="absolute bottom-[12%] left-[2.5%] hidden lg:block"
        />
        <Doodle
          name="burst"
          width={210}
          bob
          className="absolute top-[14%] right-[2%] hidden lg:block"
        />
      </div>

      <Container className="relative z-[2] mx-auto max-w-[880px] text-center">
        <Reveal className="mb-6 inline-flex items-center gap-2">
          <Sparkle size={16} float={false} />
          <span className="text-on-surface-variant text-xs font-semibold tracking-[0.18em] uppercase">
            Music-aware fireworks planning
          </span>
        </Reveal>

        <Reveal delay={0.08}>
          <h1 className="text-on-surface relative m-0 text-[clamp(2.25rem,12vw,5.625rem)] leading-[1.02] font-extrabold tracking-[-0.035em] text-balance sm:text-[clamp(46px,7vw,90px)] sm:leading-[0.97]">
            {title}
            <br />
            <Mark>{highlight}</Mark>
            <Star4 size={24} className="absolute -top-1.5 right-[14%] hidden sm:block" />
          </h1>
        </Reveal>

        <Reveal delay={0.16}>
          <p className="text-on-surface-variant mx-auto mt-6 max-w-[520px] text-lg leading-relaxed">
            {subtitle}
          </p>
        </Reveal>

        <Reveal delay={0.24} className="mt-8 flex flex-wrap justify-center gap-3">
          <Button href={primaryHref} size="lg">
            {primaryLabel}
            <ArrowRight aria-hidden="true" size={16} />
          </Button>
          {secondaryHref ? (
            <Button href={secondaryHref} size="lg" variant="secondary">
              <Play aria-hidden="true" size={18} />
              {secondaryLabel}
            </Button>
          ) : null}
        </Reveal>

        <Reveal
          delay={0.32}
          className="mt-8 inline-flex flex-wrap items-center justify-center gap-3.5"
        >
          {CAPABILITIES.map((capability) => (
            <span
              key={capability}
              className="border-outline-variant/40 bg-surface-container-low text-on-surface-variant inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm"
            >
              <span aria-hidden className="bg-primary h-1.5 w-1.5 rounded-full" />
              {capability}
            </span>
          ))}
        </Reveal>
      </Container>
    </section>
  );
}
