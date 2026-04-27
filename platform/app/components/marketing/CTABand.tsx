import { ArrowRight } from "lucide-react";
import { Container } from "@/app/components/ui/Container";
import { Button } from "@/app/components/ui/Button";

type CTABandProps = {
  title: string;
  description: string;
  primaryHref: string;
  primaryLabel: string;
};

export function CTABand({
  title,
  description,
  primaryHref,
  primaryLabel,
}: CTABandProps) {
  return (
    <section className="py-24">
      <Container>
        <div className="relative isolate overflow-hidden rounded-3xl border border-outline-variant/20 bg-surface-container-high p-12 text-center md:p-24">
          {/* Layered gradient + glow — replaces the dark Google bg image. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_30%_20%,color-mix(in_srgb,var(--color-primary)_25%,transparent),transparent_55%),radial-gradient(circle_at_75%_80%,color-mix(in_srgb,var(--color-tertiary)_18%,transparent),transparent_60%)]"
          />
          <div aria-hidden className="noise-overlay -z-10" />
          <div
            aria-hidden
            className="pointer-events-none absolute -top-1/2 left-1/2 -z-10 h-[800px] w-[800px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
          />

          <div className="relative z-10 mx-auto max-w-2xl space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-primary">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
              Ready when you are
            </span>
            <h2 className="text-4xl font-bold tracking-tight text-on-surface md:text-6xl">
              {title}
            </h2>
            <p className="text-lg text-on-surface-variant">{description}</p>
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
