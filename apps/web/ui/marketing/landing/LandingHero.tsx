/** Landing hero: the headline over the ruled grid, then the live sky visitors can launch shells into. */
import type { CSSProperties } from 'react';
import { ArrowRight, CalendarClock, Music4, PoundSterling, Sparkles } from 'lucide-react';
import { Button } from '@/ui/patterns/Button';
import { GridBackground } from '@/ui/kit/grid-background';
import { AnimatedGradientText, BorderBeam, ShimmerLink } from '@/ui/kit/motion';
import { Reveal, Rise } from '@/ui/kit/reveal';
import { ShowPreviewPanel } from './ShowPreviewPanel';

/** Real show states either side of the headline, as shares of the hero text area. */
const CHIPS = [
  { x: 0.08, y: 0.2, Icon: Sparkles, label: 'Peony', detail: 'Gold to rose' },
  { x: 0.92, y: 0.2, Icon: Music4, label: 'Cue 14', detail: 'On the drop at 0:42' },
  { x: 0.1, y: 0.72, Icon: PoundSterling, label: '£480', detail: 'of a £500 budget' },
  { x: 0.9, y: 0.72, Icon: CalendarClock, label: '3:00', detail: 'New Year finale' },
] as const;

export function LandingHero() {
  return (
    <section className="border-border relative isolate border-b">
      <GridBackground />
      <Reveal
        immediate
        className="border-border relative mx-auto max-w-6xl px-4 pt-16 pb-12 sm:px-10 sm:pt-24 lg:border-x"
      >
        <div className="relative">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden lg:block">
            {CHIPS.map(({ x, y, Icon, label, detail }, index) => (
              <div
                key={label}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
              >
                <Rise delay={450 + index * 90}>
                  <div
                    className="sc-float border-border bg-background/90 flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[11px] shadow-sm"
                    style={{ animationDelay: `${index * -1.4}s` } as CSSProperties}
                  >
                    <Icon size={13} className="text-primary" />
                    <span className="text-foreground font-medium whitespace-nowrap">{label}</span>
                    <span className="text-muted-foreground whitespace-nowrap">{detail}</span>
                  </div>
                </Rise>
              </div>
            ))}
          </div>

          <div className="relative flex flex-col items-center pb-14 text-center sm:pb-20">
            <Rise delay={0}>
              <p className="border-border bg-background/80 text-muted-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[11px] tracking-wide uppercase">
                <span aria-hidden className="bg-primary size-1.5 rounded-full" />
                Music-aware fireworks planning
              </p>
            </Rise>
            <Rise delay={80}>
              <h1 className="text-foreground mt-6 max-w-3xl text-[clamp(2.4rem,9vw,4.5rem)] leading-[1.02] font-semibold tracking-[-0.035em] text-balance">
                Design a fireworks show <AnimatedGradientText>you can see</AnimatedGradientText>{' '}
                before you buy.
              </h1>
            </Rise>
            <Rise delay={160}>
              <p className="text-muted-foreground mx-auto mt-6 max-w-xl text-base leading-relaxed sm:text-lg">
                Pick a song, set a budget and build a cue timeline from real catalogue products.
                Every preview runs on the same 3D renderer.
              </p>
            </Rise>
            <Rise delay={240} className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ShimmerLink href="/shows/new">
                Create a show
                <ArrowRight aria-hidden="true" size={16} />
              </ShimmerLink>
              <Button href="/catalogue" size="lg" variant="secondary" className="h-11 rounded-full">
                Browse the catalogue
              </Button>
            </Rise>
          </div>
        </div>

        <Rise delay={380}>
          <BorderBeam className="rounded-[21px] p-px" surface="var(--stage-night)">
            <ShowPreviewPanel launchable height="clamp(360px, 62vw, 560px)" />
          </BorderBeam>
        </Rise>
      </Reveal>
    </section>
  );
}
