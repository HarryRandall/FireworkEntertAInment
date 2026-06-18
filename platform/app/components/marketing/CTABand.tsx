/**
 * CTABand — full-width call-to-action band rendered near the bottom of
 * marketing pages. Light, doodle-framed, with a primary action and an
 * optional secondary link. Shared across the marketing site.
 */
import { ArrowRight } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { Container } from '@/app/components/ui/Container';
import { Reveal } from './Reveal';
import { Doodle, Star4 } from './landing/decor';

type CTABandProps = {
  title: string;
  description: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

export function CTABand({
  title,
  description,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: CTABandProps) {
  return (
    <section className="bg-background border-outline-variant/60 relative overflow-hidden border-t py-24">
      <Doodle
        name="fire"
        width={180}
        bob
        className="absolute bottom-[10%] left-[6%] hidden opacity-90 lg:block"
      />
      <Doodle
        name="burst"
        width={170}
        bob
        className="absolute top-[12%] right-[6%] hidden opacity-90 lg:block"
      />
      <Container className="relative z-[2] mx-auto max-w-[720px] text-center">
        <Star4 size={24} style={{ margin: '0 auto 18px' }} />
        <Reveal>
          <h2 className="text-on-surface m-0 text-[clamp(34px,5.6vw,64px)] leading-none font-extrabold tracking-[-0.035em]">
            {title}
          </h2>
        </Reveal>
        <Reveal delay={0.08}>
          <p className="text-on-surface-variant mx-auto mt-5 max-w-[520px] text-lg leading-relaxed">
            {description}
          </p>
        </Reveal>
        <Reveal delay={0.16} className="mt-8 flex flex-wrap justify-center gap-3">
          <Button href={primaryHref} size="lg">
            {primaryLabel}
            <ArrowRight size={16} />
          </Button>
          {secondaryHref ? (
            <Button href={secondaryHref} size="lg" variant="secondary">
              {secondaryLabel}
            </Button>
          ) : null}
        </Reveal>
      </Container>
    </section>
  );
}
