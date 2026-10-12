/** Real counts from the effect library, then three ways into the product as small working views. */
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowUpRight, Check } from 'lucide-react';
import { effectTemplates } from '@showcrafter/renderer';
import { NumberTicker } from '@/ui/kit/number-ticker';
import { Reveal, Rise } from '@/ui/kit/reveal';
import { SpotlightCard } from '@/ui/kit/spotlight-card';
import { CatalogueTiles } from './CatalogueTiles';

const EFFECT_COUNT = effectTemplates.length;
const KIND_COUNT = new Set(effectTemplates.map((entry) => entry.design.kind)).size;
const ENERGY = [0.35, 0.5, 0.42, 0.68, 0.6, 0.85, 0.72, 1];

type Start = { title: string; description: string; href: string; visual: ReactNode };

const STARTS: readonly Start[] = [
  {
    title: 'Plan your own show',
    description: 'Brief, song and budget in; cue timeline, 3D preview and shopping list out.',
    href: '/shows/new',
    visual: (
      <ul className="grid gap-1.5 text-xs">
        {[
          ['Gold peony cake', '2 x', '£64'],
          ['Crossette barrage', '1 x', '£89'],
          ['Willow finale', '1 x', '£120'],
        ].map(([name, quantity, price]) => (
          <li
            key={name}
            className="bg-muted/60 flex h-8 items-center gap-2 rounded-md px-2.5 tabular-nums"
          >
            <Check aria-hidden size={12} className="text-primary" />
            <span className="text-foreground min-w-0 flex-1 truncate">{name}</span>
            <span className="text-muted-foreground">{quantity}</span>
            <span className="text-foreground font-medium">{price}</span>
          </li>
        ))}
      </ul>
    ),
  },
  {
    title: 'Browse the catalogue',
    description: 'Real products, each with a preview rendered from its design.',
    href: '/catalogue',
    visual: <CatalogueTiles />,
  },
  {
    title: 'Start from a template',
    description: 'Open a curated show and make it yours.',
    href: '/library',
    visual: (
      <div className="grid gap-2">
        <div className="flex h-12 items-end gap-1">
          {ENERGY.map((level, index) => (
            <span
              key={index}
              style={{ height: `${level * 100}%` }}
              className="bg-hl/70 flex-1 rounded-t-sm"
            />
          ))}
        </div>
        <p className="text-muted-foreground flex justify-between text-[11px]">
          <span>Midnight countdown</span>
          <span className="tabular-nums">2:30</span>
        </p>
      </div>
    ),
  },
];

export function LandingStarts() {
  return (
    <section aria-labelledby="starts-heading" className="border-border border-b">
      <Reveal className="border-border mx-auto max-w-6xl lg:border-x">
        <dl className="border-border grid grid-cols-2 border-b">
          {[
            { value: EFFECT_COUNT, label: 'effect designs in the renderer library' },
            { value: KIND_COUNT, label: 'kinds of firework, from shells to fountains' },
          ].map((stat, index) => (
            <Rise
              key={stat.label}
              delay={index * 80}
              className="border-border px-4 py-8 sm:px-10 sm:py-10 [&:not(:first-child)]:border-l"
            >
              <dt className="sr-only">{stat.label}</dt>
              <dd className="text-foreground text-4xl font-semibold tracking-tight sm:text-5xl">
                <NumberTicker value={stat.value} />
              </dd>
              <dd className="text-muted-foreground mt-2 text-sm">{stat.label}</dd>
            </Rise>
          ))}
        </dl>
        <div className="border-border border-b px-4 py-10 sm:px-10 sm:py-14">
          <Rise>
            <h2
              id="starts-heading"
              className="text-foreground max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
            >
              Three ways to start.
            </h2>
          </Rise>
        </div>
        <ul className="bg-border grid gap-px md:grid-cols-3">
          {STARTS.map((start, index) => (
            <li key={start.title} className="bg-background">
              <Rise delay={100 + index * 70} className="h-full">
                <SpotlightCard className="group h-full p-6 sm:p-8">
                  <div aria-hidden="true" className="min-h-28">
                    {start.visual}
                  </div>
                  <h3 className="text-foreground mt-6 flex items-center gap-1 text-[15px] font-semibold">
                    <Link
                      href={start.href}
                      className="after:absolute after:inset-0 focus-visible:outline-none"
                    >
                      {start.title}
                    </Link>
                    <ArrowUpRight
                      aria-hidden
                      className="text-muted-foreground size-3.5 opacity-0 transition-opacity group-hover:opacity-100"
                    />
                  </h3>
                  <p className="text-muted-foreground mt-1 text-sm">{start.description}</p>
                </SpotlightCard>
              </Rise>
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
}
