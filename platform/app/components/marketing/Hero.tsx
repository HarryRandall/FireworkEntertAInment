/**
 * Hero — type-forward landing hero. A big marker-highlighted headline
 * framed by hand-drawn firework doodles, with the primary "create a show"
 * action, a secondary "see how it works" link, and a social-proof row.
 */
import { ArrowRight, Play } from 'lucide-react';
import { Container } from '@/app/components/ui/Container';
import { Button } from '@/app/components/ui/Button';
import { Reveal } from './Reveal';
import { Doodle } from './landing/Doodle';
import { Avatar, Mark, Sparkle, Star4 } from './landing/decor';

type HeroProps = {
  title: string;
  highlight: string;
  subtitle: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

const PROOF_AVATARS: { name: string; tone: string }[] = [
  { name: 'Mia R', tone: '#efb93f' },
  { name: 'Tom K', tone: '#15bd8b' },
  { name: 'Ada P', tone: '#8f7be8' },
  { name: 'Jo L', tone: '#fb7185' },
];

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
    <section className="relative overflow-hidden pt-18 pb-20 lg:pt-24">
      {/* atmospheric wash behind the headline */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="hero-rainbow-wash absolute top-[42%] left-1/2 h-[30rem] w-[min(70rem,110vw)] -translate-x-1/2 -translate-y-1/2" />
        <div aria-hidden className="noise-overlay" />
      </div>

      {/* flanking doodles steer the eye toward the headline */}
      <Doodle
        name="fire"
        width={230}
        bob
        className="absolute bottom-[12%] left-[2.5%] z-[1] hidden lg:block"
      />
      <Doodle
        name="burst"
        width={210}
        bob
        className="absolute top-[14%] right-[2%] z-[1] hidden lg:block"
      />

      <Container className="relative z-[2] mx-auto max-w-[880px] text-center">
        <Reveal className="mb-6 inline-flex items-center gap-2">
          <Sparkle size={16} float={false} />
          <span className="text-on-surface-variant text-xs font-semibold tracking-[0.18em] uppercase">
            AI fireworks choreography
          </span>
        </Reveal>

        <Reveal delay={0.08}>
          <h1 className="text-on-surface relative m-0 text-[clamp(46px,7vw,90px)] leading-[0.97] font-extrabold tracking-[-0.035em]">
            {title}
            <br />
            <Mark>{highlight}</Mark>
            <Star4 size={24} style={{ position: 'absolute', top: -6, right: '14%' }} />
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
            <ArrowRight size={16} />
          </Button>
          {secondaryHref ? (
            <Button href={secondaryHref} size="lg" variant="secondary">
              <Play size={18} />
              {secondaryLabel}
            </Button>
          ) : null}
        </Reveal>

        <Reveal
          delay={0.32}
          className="mt-8 inline-flex flex-wrap items-center justify-center gap-3.5"
        >
          <div className="flex">
            {PROOF_AVATARS.map((a, i) => (
              <span
                key={a.name}
                className="rounded-full shadow-[0_0_0_2px_var(--background)]"
                style={{ marginLeft: i ? -10 : 0 }}
              >
                <Avatar name={a.name} tone={a.tone} />
              </span>
            ))}
          </div>
          <span className="text-on-surface-variant text-sm">
            <strong className="text-on-surface tabular-nums">12,400+</strong> shows choreographed
          </span>
        </Reveal>
      </Container>
    </section>
  );
}
