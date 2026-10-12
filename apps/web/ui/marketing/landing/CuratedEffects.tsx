'use client';

/** Eight hand-picked effects beside one live preview of whichever is chosen. */
import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { effectTemplates } from '@showcrafter/renderer';
import { DesignPreview } from '@/ui/firework-editor/renderer-design/preview';
import { CanvasSurface } from '@/ui/renderer/CanvasSurface';
import { Reveal, Rise } from '@/ui/kit/reveal';
import { PosterImage } from '@/ui/kit/show-card';
import { cn } from '@/lib/utils';
import { useLandingPosters, useNearViewport } from './useLandingPosters';

const CURATED_KEYS = [
  ['chrysanthemum', 'Long trailing stars'],
  ['peony', 'A round burst of colour'],
  ['willow', 'Gold trails that hang'],
  ['crossette', 'Stars that split in four'],
  ['dahlia', 'Large, slow petals'],
  ['crackPalm', 'Thick trunks that crackle'],
  ['brocadeCrown', 'A glittering gold crown'],
  ['strobe', 'Flashing white stars'],
] as const;

const CURATED = CURATED_KEYS.map(([key, detail]) => {
  const template = effectTemplates.find((entry) => entry.key === key);
  if (!template) throw new Error(`The landing page needs the ${key} template.`);
  return { ...template, detail };
});

export function CuratedEffects() {
  const [section, setSection] = useState<HTMLElement | null>(null);
  const near = useNearViewport(section);
  const posters = useLandingPosters(CURATED, near);
  const [selected, setSelected] = useState(0);
  const active = CURATED[selected] ?? CURATED[0];

  return (
    <section
      ref={setSection}
      id="effects"
      aria-labelledby="effects-heading"
      className="border-border scroll-mt-16 border-b"
    >
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
              Choose an effect to watch it burst. The same designs drive catalogue previews,
              templates and your own shows.
            </p>
          </Rise>
        </div>

        <Rise delay={140} className="mt-10">
          <div className="border-border bg-card grid overflow-hidden rounded-2xl border lg:grid-cols-[minmax(0,1fr)_20rem]">
            <figure className="bg-stage-night relative aspect-[16/10] lg:aspect-auto lg:min-h-[30rem]">
              {near ? (
                <CanvasSurface className="absolute inset-0">
                  <DesignPreview document={active.design} player={false} loop lowPower="auto" />
                </CanvasSurface>
              ) : null}
              <figcaption className="pointer-events-none absolute bottom-4 left-4 z-10">
                <span className="text-stage-glass-foreground block text-lg font-semibold tracking-tight">
                  {active.name}
                </span>
                <span className="text-stage-glass-muted block text-sm">{active.detail}</span>
              </figcaption>
            </figure>

            <ul
              aria-label="Effects"
              className="border-border grid grid-cols-2 gap-1 border-t p-2 lg:grid-cols-1 lg:border-t-0 lg:border-l"
            >
              {CURATED.map((template, index) => (
                <li key={template.key}>
                  <button
                    type="button"
                    aria-pressed={index === selected}
                    onPointerEnter={(event) => {
                      if (event.pointerType === 'mouse') setSelected(index);
                    }}
                    onFocus={() => setSelected(index)}
                    onClick={() => setSelected(index)}
                    className={cn(
                      'focus-visible:ring-ring flex w-full items-center gap-3 rounded-lg p-1.5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none',
                      index === selected ? 'bg-muted' : 'hover:bg-muted/60',
                    )}
                  >
                    <PosterImage
                      url={posters.urls[template.key]}
                      error={posters.failed[template.key] ? ' ' : undefined}
                      className="w-14 shrink-0 rounded-md"
                    />
                    <span className="min-w-0">
                      <span className="text-foreground block truncate text-sm font-medium">
                        {template.name}
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {template.detail}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Rise>

        <Rise delay={220} className="mt-6 text-sm">
          <Link
            href="/catalogue"
            className="text-foreground inline-flex items-center gap-1.5 font-medium hover:underline"
          >
            Browse the catalogue <ArrowRight aria-hidden size={14} />
          </Link>
        </Rise>
      </Reveal>
    </section>
  );
}
