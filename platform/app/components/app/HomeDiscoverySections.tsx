'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { BadgeDollarSign, ChevronRight, Clock3, ListMusic, Play } from 'lucide-react';
import { CoverPoster } from '@/app/components/app/CoverPoster';
import type { ShowTemplate } from '@/lib/admin.types';
import { formatBudget, formatDuration, type FireworkSpecification } from '@/lib/show-domain';
import {
  shaderCoverFromSeed,
  shaderCoverGradient,
  type ShaderCover as ShaderCoverConfig,
} from '@/lib/shader-cover';

const TemplateReplayPreview = dynamic(
  () =>
    import('@/app/components/app/TemplateReplayPreview').then((mod) => mod.TemplateReplayPreview),
  { ssr: false, loading: () => null },
);

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

function FeaturedShowCard({
  template,
  index,
  specifications,
}: {
  template: ShowTemplate;
  index: number;
  specifications: FireworkSpecification[];
}) {
  const cover = template.coverShader ?? shaderCoverFromSeed(template.id || template.slug);
  const [isPreviewActive, setIsPreviewActive] = useState(false);
  const [isPreviewReady, setIsPreviewReady] = useState(false);
  const [accentStart, accentMiddle = accentStart, accentEnd = accentStart] = cover.colors;
  const accentStyle = {
    '--show-accent-start': accentStart,
    '--show-accent-middle': accentMiddle,
    '--show-accent-end': accentEnd,
  } as CSSProperties;
  const showReplay =
    isPreviewActive && template.previewCues.length > 0 && specifications.length > 0;

  function startPreview() {
    setIsPreviewActive(true);
  }

  function stopPreview() {
    setIsPreviewActive(false);
    setIsPreviewReady(false);
  }

  return (
    <Link
      href={`/library/${template.slug}`}
      prefetch={false}
      aria-label={`Watch ${template.title}`}
      className="group focus-visible:ring-primary/45 focus-visible:ring-offset-background relative isolate min-h-[14rem] overflow-hidden rounded-2xl bg-[color:var(--color-bg-elevated)] shadow-sm transition-transform duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      style={accentStyle}
      onPointerEnter={startPreview}
      onPointerLeave={stopPreview}
      onFocus={startPreview}
      onBlur={stopPreview}
    >
      <CoverPoster
        imagePath={template.coverImagePath}
        eager
        className={`z-0 transition-[opacity,transform] duration-700 ease-out group-hover:scale-105 ${
          isPreviewReady ? 'opacity-0' : 'opacity-100'
        }`}
      />
      {showReplay ? (
        <TemplateReplayPreview
          template={template}
          specifications={specifications}
          isCardHovered={isPreviewActive}
          showCardOverlays={false}
          lazyHoverMount
          onReady={() => setIsPreviewReady(true)}
          cardClassName={`absolute inset-0 z-[1] h-full w-full overflow-hidden transition-opacity duration-200 ${
            isPreviewReady ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ) : null}
      <div
        aria-hidden
        className="absolute inset-0 z-[2] bg-[radial-gradient(circle_at_82%_18%,rgba(255,255,255,0.18),transparent_32%),linear-gradient(90deg,rgba(0,0,0,0.78)_0%,rgba(0,0,0,0.5)_48%,rgba(0,0,0,0.12)_100%)]"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-px z-20 rounded-[calc(var(--radius-2xl)-1px)] border border-white/20"
      />
      <span className="absolute top-4 right-4 z-10 hidden h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white transition-transform duration-200 group-hover:scale-105 sm:flex">
        <Play size={18} fill="currentColor" />
      </span>
      {/* Tucked into the top-left corner, out of the content flow. No
          backdrop-filter: blurred layers re-rasterise on every pinch-zoom
          step and flicker. */}
      <span className="absolute top-3 left-3 z-10 inline-flex h-5 items-center rounded-full border border-white/15 bg-white/14 px-2.5 text-[9px] leading-none font-semibold tracking-[0.12em] text-white/90 uppercase">
        {index === 0 ? 'Featured show' : 'Full replay'}
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
          <span
            className="inline-flex items-center gap-1.5"
            title="Estimated retail cost of fireworks"
          >
            <BadgeDollarSign size={13} />
            <span className="tabular-nums">{formatBudget(template.totalCents)}</span>
          </span>
        </div>
        <span className="mt-5 inline-flex h-10 w-fit items-center gap-2 rounded-full bg-white/16 px-4 text-sm font-medium text-white transition-colors duration-200 group-hover:bg-white/22">
          Watch replay
          <ChevronRight size={15} />
        </span>
      </div>
    </Link>
  );
}

export function HomeFeaturedShows({
  templates,
  specifications,
}: {
  templates: ShowTemplate[];
  specifications: FireworkSpecification[];
}) {
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
          <FeaturedShowCard
            key={template.id}
            template={template}
            index={index}
            specifications={specifications}
          />
        ))}
      </div>
    </section>
  );
}

const COLLECTION_BACK_BORDER =
  'color-mix(in srgb, var(--collection-accent-middle) 34%, var(--color-border-subtle))';
const COLLECTION_MIDDLE_BORDER =
  'color-mix(in srgb, var(--collection-accent-start) 38%, var(--color-border-subtle))';

type CollectionCard = {
  title: string;
  href: string;
  accentStyle: CSSProperties;
  backGradient: string;
  middleGradient: string;
  coverGradient: string;
};

// Collection covers and their gradients are deterministic from the seed, so
// compute them once at module load instead of on every render (3 gradient
// strings x 5 collections per render previously).
const COLLECTION_CARDS: CollectionCard[] = COLLECTIONS.map((collection) => {
  const cover = shaderCoverFromSeed(`home-collection:${collection.seed}`);
  const backCover = collectionLayerCover(collection.seed, 'back', cover);
  const middleCover = collectionLayerCover(collection.seed, 'middle', cover);
  const [accentStart, accentMiddle = accentStart, accentEnd = accentStart] = cover.colors;
  return {
    title: collection.title,
    href: collection.href,
    accentStyle: {
      '--collection-accent-start': accentStart,
      '--collection-accent-middle': accentMiddle,
      '--collection-accent-end': accentEnd,
    } as CSSProperties,
    backGradient: shaderCoverGradient(backCover),
    middleGradient: shaderCoverGradient(middleCover),
    coverGradient: shaderCoverGradient(cover),
  };
});

export function HomeCollectionsSection() {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const node = scrollerRef.current;
    if (!node) return;
    const maxScroll = node.scrollWidth - node.clientWidth;
    setCanScrollLeft(node.scrollLeft > 1);
    setCanScrollRight(maxScroll > 1 && node.scrollLeft < maxScroll - 1);
  }, []);

  useEffect(() => {
    updateScrollState();
    const node = scrollerRef.current;
    if (!node) return;

    node.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);
    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateScrollState);
    resizeObserver?.observe(node);

    return () => {
      node.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
      resizeObserver?.disconnect();
    };
  }, [updateScrollState]);

  return (
    <section className="space-y-4">
      <h2 className="text-on-surface text-lg font-semibold tracking-tight">Curated collections</h2>
      <div className="relative -mx-4 sm:-mx-6 lg:mx-0">
        {canScrollLeft ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-[color:var(--color-bg-default)] to-transparent lg:hidden"
          />
        ) : null}
        {canScrollRight ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-[color:var(--color-bg-default)] to-transparent lg:hidden"
          />
        ) : null}
        <div
          ref={scrollerRef}
          className="flex snap-x snap-mandatory scroll-px-4 gap-5 overflow-x-auto px-4 pt-1 pb-4 [scrollbar-width:none] sm:scroll-px-6 sm:gap-6 sm:px-6 lg:grid lg:grid-cols-5 lg:gap-[clamp(1.25rem,2.4vw,2.75rem)] lg:overflow-visible lg:px-0 lg:pb-2 [&::-webkit-scrollbar]:hidden"
        >
          {COLLECTION_CARDS.map((card) => (
            <Link
              key={card.title}
              href={card.href}
              className="group focus-visible:ring-primary/45 focus-visible:ring-offset-background block w-[min(62vw,12rem)] shrink-0 cursor-pointer snap-start rounded-2xl p-1.5 transition-transform duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 motion-reduce:transition-none sm:w-52 lg:w-auto lg:min-w-0"
              aria-label={`Open ${card.title}`}
              style={card.accentStyle}
            >
              <div className="relative pt-5">
                <div
                  aria-hidden
                  className="pointer-events-none absolute top-0 right-8 left-8 z-0 aspect-square overflow-hidden rounded-xl border bg-[color:var(--color-bg-elevated)] opacity-70"
                  style={{ borderColor: COLLECTION_BACK_BORDER }}
                >
                  <div
                    className="absolute inset-0 h-full w-full"
                    style={{ background: card.backGradient }}
                  />
                </div>
                <div
                  aria-hidden
                  className="pointer-events-none absolute top-2.5 right-4 left-4 z-0 aspect-square overflow-hidden rounded-xl border bg-[color:var(--color-bg-elevated)] opacity-[.82]"
                  style={{ borderColor: COLLECTION_MIDDLE_BORDER }}
                >
                  <div
                    className="absolute inset-0 h-full w-full"
                    style={{ background: card.middleGradient }}
                  />
                </div>
                <div className="relative z-10 aspect-square overflow-hidden rounded-xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-elevated)] shadow-sm">
                  <div
                    className="absolute inset-0 h-full w-full"
                    style={{ background: card.coverGradient }}
                  />
                </div>
              </div>
              <h3 className="text-on-surface group-hover:text-primary mt-2.5 line-clamp-1 text-sm font-semibold transition-colors">
                {card.title}
              </h3>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
