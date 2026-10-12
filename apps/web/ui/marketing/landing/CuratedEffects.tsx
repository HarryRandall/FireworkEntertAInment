'use client';

/** A handful of hand-picked effects: real posters, and one live preview of the chosen effect. */
import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { effectTemplates } from '@showcrafter/renderer';
import { DesignPreview } from '@/ui/firework-editor/renderer-design/preview';
import { CanvasSurface } from '@/ui/renderer/CanvasSurface';
import { Marquee } from '@/ui/kit/motion';
import { Reveal, Rise } from '@/ui/kit/reveal';
import { PosterImage } from '@/ui/kit/show-card';
import { SpotlightCard } from '@/ui/kit/spotlight-card';
import { cn } from '@/lib/utils';
import { useLandingPosters, useNearViewport } from './useLandingPosters';

const CURATED_KEYS = [
  'chrysanthemum',
  'peony',
  'willow',
  'crossette',
  'dahlia',
  'crackPalm',
  'brocadeCrown',
  'strobe',
] as const;

const CURATED = CURATED_KEYS.map((key) => {
  const template = effectTemplates.find((entry) => entry.key === key);
  if (!template) throw new Error(`The landing page needs the ${key} template.`);
  return template;
});

const MORE = effectTemplates
  .filter((entry) => !CURATED_KEYS.some((key) => key === entry.key))
  .slice(0, 24);

export function CuratedEffects() {
  const [section, setSection] = useState<HTMLElement | null>(null);
  const near = useNearViewport(section);
  const posters = useLandingPosters(CURATED, near);
  const [selected, setSelected] = useState(0);
  const active = CURATED[selected] ?? CURATED[0];

  return (
    <section ref={setSection} aria-labelledby="effects-heading" className="border-border border-b">
      <Reveal className="border-border mx-auto max-w-6xl px-4 py-14 sm:px-10 sm:py-20 lg:border-x">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-end">
          <Rise>
            <p className="text-muted-foreground font-mono text-[11px] tracking-wide uppercase">
              Effects
            </p>
            <h2
              id="effects-heading"
              className="text-foreground mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
            >
              Every effect is simulated, not filmed.
            </h2>
          </Rise>
          <Rise delay={80}>
            <p className="text-muted-foreground text-sm leading-relaxed sm:text-base">
              Point at an effect to watch it burst. The same designs drive catalogue previews,
              templates and your own shows.
            </p>
          </Rise>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <Rise delay={140}>
            <ul className="bg-border border-border grid grid-cols-2 gap-px overflow-hidden rounded-xl border sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
              {CURATED.map((template, index) => (
                <li key={template.key} className="bg-card">
                  <SpotlightCard className="h-full">
                    <button
                      type="button"
                      aria-pressed={index === selected}
                      onPointerEnter={(event) => {
                        if (event.pointerType === 'mouse') setSelected(index);
                      }}
                      onFocus={() => setSelected(index)}
                      onClick={() => setSelected(index)}
                      className={cn(
                        'focus-visible:ring-ring group grid w-full grid-cols-[minmax(0,1fr)] gap-2 p-2 text-left focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset',
                        index === selected && 'bg-accent/60',
                      )}
                    >
                      <PosterImage
                        url={posters.urls[template.key]}
                        error={posters.failed[template.key] ? 'Preview unavailable' : undefined}
                        className="rounded-md"
                      />
                      <span className="text-foreground px-1 pb-1 text-sm font-medium">
                        {template.name}
                      </span>
                    </button>
                  </SpotlightCard>
                </li>
              ))}
            </ul>
          </Rise>

          <Rise delay={200}>
            <figure className="bg-stage-night relative grid aspect-[4/3] overflow-hidden rounded-xl lg:aspect-auto lg:h-full">
              {near ? (
                <CanvasSurface className="absolute inset-0">
                  <DesignPreview document={active.design} player={false} loop lowPower="auto" />
                </CanvasSurface>
              ) : null}
              <figcaption className="text-stage-glass-foreground pointer-events-none absolute top-3 left-3 z-10 rounded-md bg-black/50 px-2.5 py-1 text-xs font-medium">
                {active.name}
              </figcaption>
            </figure>
          </Rise>
        </div>

        <Rise delay={260} className="mt-6">
          <Marquee
            label="more effect names"
            items={MORE.map((template) => ({
              key: template.key,
              node: (
                <span className="border-border bg-background text-muted-foreground rounded-full border px-3 py-1 text-xs whitespace-nowrap">
                  {template.name}
                </span>
              ),
            }))}
          />
        </Rise>
        <Rise delay={300} className="mt-4">
          <Link
            href="/catalogue"
            className="text-foreground inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
          >
            Browse the catalogue <ArrowRight aria-hidden size={14} />
          </Link>
        </Rise>
      </Reveal>
    </section>
  );
}
