'use client';

/**
 * ExploreRow — a titled, horizontally scrolling section of ExploreCards,
 * styled after a music-app shelf. Includes a "See all" link and hover scroll
 * arrows that page the shelf left and right.
 */
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ExploreCard } from '@/components/explore/ExploreCard';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import type { ShowTemplateSummary } from '@/lib/show-template-summary';
import { cn } from '@/lib/utils';

export function ExploreRow({
  title,
  templates,
  seeAllHref,
}: {
  title: string;
  templates: ShowTemplateSummary[];
  seeAllHref?: string;
}) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const node = scrollerRef.current;
    if (!node) return;
    const maxScroll = node.scrollWidth - node.clientWidth;
    setCanScrollLeft(node.scrollLeft > 1);
    setCanScrollRight(node.scrollLeft < maxScroll - 1);
  }, []);

  useEffect(() => {
    updateScrollState();
    const node = scrollerRef.current;
    if (!node) return;
    node.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);
    return () => {
      node.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [updateScrollState, templates.length]);

  if (templates.length === 0) return null;

  function scrollBy(direction: 1 | -1) {
    const node = scrollerRef.current;
    if (!node) return;
    node.scrollBy({
      left: direction * node.clientWidth * 0.85,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  }

  return (
    <section className="group/row relative">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-on-surface text-lg font-semibold tracking-tight">{title}</h2>
        {seeAllHref ? (
          <Link
            href={seeAllHref}
            className="text-on-surface-variant hover:text-on-surface inline-flex cursor-pointer items-center gap-1 rounded-full border border-[color:var(--color-border-subtle)] px-3 py-1 text-xs font-medium transition-colors"
          >
            See all
            <ChevronRight size={14} />
          </Link>
        ) : null}
      </div>

      <div className="relative">
        <div
          ref={scrollerRef}
          data-explore-scroll-viewport
          className={cn(
            '-mt-4 -mb-6 flex [scrollbar-width:none] gap-4 overflow-x-auto pt-4 pb-7 [&::-webkit-scrollbar]:hidden',
            prefersReducedMotion ? 'scroll-auto' : 'scroll-smooth',
          )}
        >
          {templates.map((template) => (
            <ExploreCard key={template.id} template={template} />
          ))}
        </div>

        {/* Edge fades signalling there is more to scroll. */}
        {canScrollLeft ? (
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-[color:var(--color-bg-default)] to-transparent" />
        ) : null}
        {canScrollRight ? (
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-[color:var(--color-bg-default)] to-transparent" />
        ) : null}

        {canScrollLeft ? (
          <button
            type="button"
            aria-label={`Scroll ${title} left`}
            onClick={() => scrollBy(-1)}
            className="focus-visible:ring-primary/45 focus-visible:ring-offset-background absolute top-[28%] left-0 z-20 hidden h-9 w-9 -translate-x-1/2 cursor-pointer items-center justify-center rounded-full border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-elevated)] text-[color:var(--color-content-default)] opacity-0 shadow-md transition-opacity group-focus-within/row:opacity-100 group-hover/row:opacity-100 hover:bg-[color:var(--color-bg-subtle)] focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2 sm:flex"
          >
            <ChevronLeft aria-hidden="true" size={18} />
          </button>
        ) : null}
        {canScrollRight ? (
          <button
            type="button"
            aria-label={`Scroll ${title} right`}
            onClick={() => scrollBy(1)}
            className="focus-visible:ring-primary/45 focus-visible:ring-offset-background absolute top-[28%] right-0 z-20 hidden h-9 w-9 translate-x-1/2 cursor-pointer items-center justify-center rounded-full border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-elevated)] text-[color:var(--color-content-default)] opacity-0 shadow-md transition-opacity group-focus-within/row:opacity-100 group-hover/row:opacity-100 hover:bg-[color:var(--color-bg-subtle)] focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2 sm:flex"
          >
            <ChevronRight aria-hidden="true" size={18} />
          </button>
        ) : null}
      </div>
    </section>
  );
}
