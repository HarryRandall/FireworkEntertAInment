'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';
import { useState } from 'react';
import { BadgeDollarSign, ChevronRight, Clock3, ListMusic, Play } from 'lucide-react';
import { ShaderCover } from '@/app/components/app/ShaderCover';
import type { ShowTemplate } from '@/lib/admin.types';
import { formatBudget, formatDuration } from '@/lib/show-domain';
import { shaderCoverFromSeed, type ShaderCover as ShaderCoverConfig } from '@/lib/shader-cover';

const COLLECTIONS = [
  {
    title: 'Finale moments',
    href: '/library?sort=featured',
    seed: 'finale-moments',
  },
  {
    title: 'Crowd favourites',
    href: '/library?sort=popular',
    seed: 'crowd-favourites',
  },
  {
    title: 'Quick bursts',
    href: '/library?sort=shortest',
    seed: 'quick-bursts',
  },
  {
    title: 'Fresh drops',
    href: '/library?sort=recent',
    seed: 'fresh-drops',
  },
  {
    title: 'Big budget skies',
    href: '/library?sort=budget',
    seed: 'big-budget-skies',
  },
] as const;

function rotateCoverColors(colors: string[]): string[] {
  if (colors.length < 3) return colors;
  return [...colors.slice(1), colors[0]!];
}

function collectionLayerCover(
  seed: string,
  layer: 'back' | 'middle',
  baseCover: ShaderCoverConfig,
): ShaderCoverConfig {
  const variant = shaderCoverFromSeed(`home-collection:${seed}:${layer}`);
  return {
    ...variant,
    colors: layer === 'back' ? baseCover.colors : rotateCoverColors(baseCover.colors),
  };
}

function FeaturedShowCard({ template, index }: { template: ShowTemplate; index: number }) {
  const cover = template.coverShader ?? shaderCoverFromSeed(template.id || template.slug);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const shouldAnimateCover = template.slug === 'grand-finale' || template.title === 'Grand Finale';
  const coverIsActive = shouldAnimateCover && (hovered || focused);
  const [accentStart, accentMiddle = accentStart, accentEnd = accentStart] = cover.colors;
  const accentStyle = {
    '--show-accent-start': accentStart,
    '--show-accent-middle': accentMiddle,
    '--show-accent-end': accentEnd,
  } as CSSProperties;

  return (
    <Link
      href={`/library/${template.slug}`}
      prefetch
      aria-label={`Watch ${template.title}`}
      className="group focus-visible:ring-primary/45 focus-visible:ring-offset-background relative isolate min-h-[14rem] overflow-hidden rounded-2xl bg-[color:var(--color-bg-elevated)] shadow-sm transition-transform duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      style={accentStyle}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      <ShaderCover
        cover={cover}
        animate={coverIsActive}
        showSkeletonUntilReady
        className="transition-transform duration-700 ease-out group-hover:scale-105"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgba(255,255,255,0.18),transparent_32%),linear-gradient(90deg,rgba(0,0,0,0.78)_0%,rgba(0,0,0,0.5)_48%,rgba(0,0,0,0.12)_100%)]"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-20 rounded-2xl ring-1 ring-[color:var(--color-border-subtle)] ring-inset"
      />
      <span className="absolute top-2 left-5 z-10 inline-flex h-6 items-center rounded-full bg-[color:var(--color-bg-elevated)]/88 px-3 text-[11px] leading-none font-semibold text-[color:var(--color-content-default)] shadow-sm backdrop-blur sm:left-6">
        {index === 0 ? 'Featured show' : 'Full replay'}
      </span>
      <span className="absolute top-4 right-4 z-10 hidden h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition-transform duration-200 group-hover:scale-105 sm:flex">
        <Play size={18} fill="currentColor" />
      </span>
      <div className="relative z-10 flex min-h-[14rem] max-w-xl flex-col justify-end p-5 text-white sm:p-6">
        <h2 className="line-clamp-1 text-xl font-semibold tracking-tight">{template.title}</h2>
        <p className="mt-1 line-clamp-2 text-sm text-white/78">
          {template.description ?? template.theme}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-white/78">
          <span className="inline-flex items-center gap-1.5">
            <Clock3 size={13} />
            <span className="tabular-nums">{formatDuration(template.durationSeconds)}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ListMusic size={13} />
            <span className="tabular-nums">{template.previewCues.length}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <BadgeDollarSign size={13} />
            <span className="tabular-nums">{formatBudget(template.totalCents)}</span>
          </span>
        </div>
        <span className="mt-5 inline-flex h-10 w-fit items-center gap-2 rounded-full bg-white/12 px-4 text-sm font-medium text-white backdrop-blur transition-colors duration-200 group-hover:bg-white/18">
          Watch replay
          <ChevronRight size={15} />
        </span>
      </div>
    </Link>
  );
}

export function HomeFeaturedShows({ templates }: { templates: ShowTemplate[] }) {
  const featured = templates.slice(0, 2);
  if (featured.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-on-surface text-lg font-semibold tracking-tight">Watch real shows</h2>
        <Link
          href="/library"
          className="text-on-surface-variant hover:text-on-surface inline-flex items-center gap-1 rounded-full border border-[color:var(--color-border-subtle)] px-3 py-1 text-xs font-medium transition-colors"
        >
          See all
          <ChevronRight size={14} />
        </Link>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {featured.map((template, index) => (
          <FeaturedShowCard key={template.id} template={template} index={index} />
        ))}
      </div>
    </section>
  );
}

export function HomeCollectionsSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-on-surface text-lg font-semibold tracking-tight">Curated collections</h2>
      <div className="relative -mx-4 sm:-mx-6 lg:mx-0">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-[linear-gradient(90deg,var(--color-bg-default),color-mix(in_srgb,var(--color-bg-default)_72%,transparent)_48%,transparent)] backdrop-blur-[2px] lg:hidden"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-[linear-gradient(270deg,var(--color-bg-default),color-mix(in_srgb,var(--color-bg-default)_72%,transparent)_48%,transparent)] backdrop-blur-[2px] lg:hidden"
        />
        <div className="flex snap-x snap-mandatory scroll-px-4 gap-5 overflow-x-auto px-4 pt-1 pb-4 [scrollbar-width:none] sm:scroll-px-6 sm:gap-6 sm:px-6 lg:grid lg:grid-cols-5 lg:gap-[clamp(1.25rem,2.4vw,2.75rem)] lg:overflow-visible lg:px-0 lg:pb-2 [&::-webkit-scrollbar]:hidden">
          {COLLECTIONS.map((collection) => {
            const cover = shaderCoverFromSeed(`home-collection:${collection.seed}`);
            const backCover = collectionLayerCover(collection.seed, 'back', cover);
            const middleCover = collectionLayerCover(collection.seed, 'middle', cover);
            const [accentStart, accentMiddle = accentStart, accentEnd = accentStart] = cover.colors;
            const collectionAccentStyle = {
              '--collection-accent-start': accentStart,
              '--collection-accent-middle': accentMiddle,
              '--collection-accent-end': accentEnd,
            } as CSSProperties;
            return (
              <Link
                key={collection.title}
                href={collection.href}
                className="group focus-visible:ring-primary/45 focus-visible:ring-offset-background block w-[min(62vw,12rem)] shrink-0 cursor-pointer snap-start rounded-2xl p-1.5 transition-transform duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 motion-reduce:transition-none sm:w-52 lg:w-auto lg:min-w-0"
                aria-label={`Open ${collection.title}`}
                style={collectionAccentStyle}
              >
                <div className="relative pt-5">
                  <div
                    aria-hidden
                    className="pointer-events-none absolute top-0 right-8 left-8 z-0 aspect-square overflow-hidden rounded-xl border bg-[color:var(--color-bg-elevated)] opacity-70"
                    style={{
                      borderColor:
                        'color-mix(in srgb, var(--collection-accent-middle) 34%, var(--color-border-subtle))',
                    }}
                  >
                    <ShaderCover cover={backCover} animate={false} />
                  </div>
                  <div
                    aria-hidden
                    className="pointer-events-none absolute top-2.5 right-4 left-4 z-0 aspect-square overflow-hidden rounded-xl border bg-[color:var(--color-bg-elevated)] opacity-[.82]"
                    style={{
                      borderColor:
                        'color-mix(in srgb, var(--collection-accent-start) 38%, var(--color-border-subtle))',
                    }}
                  >
                    <ShaderCover cover={middleCover} animate={false} />
                  </div>
                  <div className="relative z-10 aspect-square overflow-hidden rounded-xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-elevated)] shadow-sm">
                    <ShaderCover cover={cover} animate={false} showSkeletonUntilReady />
                  </div>
                </div>
                <h3 className="text-on-surface group-hover:text-primary mt-2.5 line-clamp-1 text-sm font-semibold transition-colors">
                  {collection.title}
                </h3>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
