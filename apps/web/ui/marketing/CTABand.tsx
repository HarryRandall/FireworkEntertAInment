/**
 * CTABand: the closing call to action on marketing pages, a dark panel with a soft brand
 * glow, a primary action and an optional secondary link.
 */
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { ShimmerLink } from '@/ui/kit/motion';
import { Reveal, Rise } from '@/ui/kit/reveal';

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
    <section className="px-4 py-16 sm:px-10 sm:py-24">
      <Reveal className="bg-stage-night text-stage-glass-foreground relative isolate mx-auto max-w-6xl overflow-hidden rounded-3xl px-6 py-16 text-center sm:px-12 sm:py-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_80%_at_50%_110%,color-mix(in_srgb,var(--hl)_38%,transparent),transparent_70%),radial-gradient(40%_50%_at_15%_0%,color-mix(in_srgb,var(--show-violet)_22%,transparent),transparent_70%),radial-gradient(40%_50%_at_85%_0%,color-mix(in_srgb,var(--show-gold)_18%,transparent),transparent_70%)]"
        />
        <Rise>
          <h2 className="mx-auto max-w-2xl text-[clamp(2rem,5vw,3.5rem)] leading-[1.05] font-semibold tracking-[-0.03em] text-balance">
            {title}
          </h2>
        </Rise>
        <Rise delay={80}>
          <p className="text-stage-glass-muted mx-auto mt-5 max-w-xl text-base leading-relaxed sm:text-lg">
            {description}
          </p>
        </Rise>
        <Rise delay={160} className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <ShimmerLink href={primaryHref}>
            {primaryLabel}
            <ArrowRight aria-hidden size={16} />
          </ShimmerLink>
          {secondaryHref ? (
            <Link
              href={secondaryHref}
              className="text-stage-glass-foreground focus-visible:ring-ring inline-flex h-11 items-center justify-center rounded-full border border-white/20 bg-white/5 px-6 text-sm font-medium transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:outline-none"
            >
              {secondaryLabel}
            </Link>
          ) : null}
        </Rise>
      </Reveal>
    </section>
  );
}
