/**
 * ComingSoon — placeholder hero used by marketing routes that are
 * not yet fully fleshed out (legal pages, etc.). Drop-in replacement
 * for the regular page body until real content ships.
 */
import { Sparkles } from 'lucide-react';
import { Container } from '@/app/components/ui/Container';
import { Button } from '@/app/components/ui/Button';

type ComingSoonProps = {
  eyebrow?: string;
  title: string;
  description?: string;
};

export function ComingSoon({
  eyebrow = 'Coming Soon',
  title,
  description = "We're still drafting this with our legal team. Check back shortly — or get in touch if you have questions in the meantime.",
}: ComingSoonProps) {
  return (
    <section className="bg-background relative isolate flex min-h-[80vh] items-center overflow-hidden py-24">
      <Container className="relative z-10 flex flex-col items-center text-center">
        <span className="border-primary/30 bg-primary/10 text-primary mb-8 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-bold tracking-[0.2em] uppercase">
          <Sparkles size={14} strokeWidth={2} />
          {eyebrow}
        </span>
        <h1 className="text-on-surface max-w-3xl text-5xl leading-[1.05] font-extrabold tracking-tight md:text-7xl">
          {title}
        </h1>
        <p className="text-on-surface-variant mt-8 max-w-xl text-lg leading-relaxed">
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
