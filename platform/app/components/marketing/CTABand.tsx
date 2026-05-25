/**
 * CTABand — full-width call-to-action band rendered near the bottom
 * of marketing pages. Renders a single primary CTA — pair with the
 * site Footer for end-of-page conversion sections.
 */
import { ArrowRight } from 'lucide-react';
import { Container } from '@/app/components/ui/Container';
import { Button } from '@/app/components/ui/Button';

type CTABandProps = {
  title: string;
  description: string;
  primaryHref: string;
  primaryLabel: string;
};

export function CTABand({ title, description, primaryHref, primaryLabel }: CTABandProps) {
  return (
    <section className="py-24">
      <Container>
        <div className="border-outline-variant/20 bg-surface-container-high relative isolate overflow-hidden rounded-3xl border p-12 text-center md:p-24">
          {/* Layered gradient + glow — replaces the dark Google bg image. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_30%_20%,color-mix(in_srgb,var(--color-primary)_25%,transparent),transparent_55%),radial-gradient(circle_at_75%_80%,color-mix(in_srgb,var(--color-tertiary)_18%,transparent),transparent_60%)]"
          />
          <div aria-hidden className="noise-overlay -z-10" />
          <div
            aria-hidden
            className="bg-primary/10 pointer-events-none absolute -top-1/2 left-1/2 -z-10 h-[800px] w-[800px] -translate-x-1/2 rounded-full blur-3xl"
          />

          <div className="relative z-10 mx-auto max-w-2xl space-y-6">
            <span className="border-primary/30 bg-primary/10 text-primary inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold tracking-[0.2em] uppercase">
              <span className="bg-primary inline-block h-1.5 w-1.5 rounded-full" />
              Ready when you are
            </span>
            <h2 className="text-on-surface text-4xl font-bold tracking-tight md:text-6xl">
              {title}
            </h2>
            <p className="text-on-surface-variant text-lg">{description}</p>
            <div className="pt-4">
              <Button href={primaryHref} size="lg">
                {primaryLabel}
                <ArrowRight size={18} />
              </Button>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
