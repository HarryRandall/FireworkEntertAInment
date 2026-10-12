/** Landing hero: the headline over the ruled grid, then a published show you can look around. */
import { ArrowRight } from 'lucide-react';
import { Button } from '@/ui/patterns/Button';
import { GridBackground } from '@/ui/kit/grid-background';
import { AnimatedGradientText, BorderBeam, ShimmerLink } from '@/ui/kit/motion';
import { Reveal, Rise } from '@/ui/kit/reveal';
import { Suspense } from 'react';
import { loadHeroShow } from './heroShow.server';
import { ShowPreviewPanel } from './ShowPreviewPanel';
import styles from './landing.module.css';

const HERO_SKY_HEIGHT = 'clamp(340px, 56vw, 540px)';

/** A published Explore show on the live renderer, or the built-in demo if none loads. */
async function HeroStage() {
  const show = await loadHeroShow();
  if (!show) return <ShowPreviewPanel height={HERO_SKY_HEIGHT} />;
  return (
    <ShowPreviewPanel
      height={HERO_SKY_HEIGHT}
      cues={show.cues}
      duration={show.duration}
      title={show.title}
      subtitle={show.subtitle}
      track="Show timeline"
    />
  );
}

export function LandingHero() {
  return (
    <section className="border-border relative isolate border-b">
      <GridBackground />
      <Reveal
        immediate
        className="border-border relative mx-auto max-w-6xl px-4 pt-16 pb-12 sm:px-10 sm:pt-24 lg:border-x"
      >
        <div className="relative">
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
            <Suspense
              fallback={
                <div className={styles.skyPanel} style={{ height: HERO_SKY_HEIGHT }}>
                  <div className={styles.starfield} />
                </div>
              }
            >
              <HeroStage />
            </Suspense>
          </BorderBeam>
        </Rise>
      </Reveal>
    </section>
  );
}
