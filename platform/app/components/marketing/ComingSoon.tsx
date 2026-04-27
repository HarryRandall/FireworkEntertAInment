import { Sparkles } from "lucide-react";
import { Container } from "@/app/components/ui/Container";
import { Button } from "@/app/components/ui/Button";

type ComingSoonProps = {
  eyebrow?: string;
  title: string;
  description?: string;
};

export function ComingSoon({
  eyebrow = "Coming Soon",
  title,
  description = "We're still drafting this with our legal team. Check back shortly — or get in touch if you have questions in the meantime.",
}: ComingSoonProps) {
  return (
    <section className="relative isolate flex min-h-[80vh] items-center overflow-hidden bg-background py-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,color-mix(in_srgb,var(--color-primary)_12%,transparent),transparent_65%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl"
      />
      <Container className="relative z-10 flex flex-col items-center text-center">
        <span className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-primary">
          <Sparkles size={14} strokeWidth={2} />
          {eyebrow}
        </span>
        <h1 className="max-w-3xl text-5xl font-extrabold leading-[1.05] tracking-tight text-on-surface md:text-7xl">
          {title}
        </h1>
        <p className="mt-8 max-w-xl text-lg leading-relaxed text-on-surface-variant">
          {description}
        </p>
        <div className="mt-12 flex flex-col items-center gap-4 sm:flex-row">
          <Button href="/" size="lg">
            Back to home
          </Button>
          <Button href="/contact" size="lg" variant="secondary">
            Contact us
          </Button>
        </div>
      </Container>
    </section>
  );
}
