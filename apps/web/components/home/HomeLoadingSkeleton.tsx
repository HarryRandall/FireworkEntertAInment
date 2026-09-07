import Link from 'next/link';
import { ChevronRight, Clock3, ListMusic, Play } from 'lucide-react';
import { HomeCollectionsSection } from '@/components/home/HomeDiscoverySections';
import { PromptHero } from '@/components/shows/ShowSummaryCards';
import { Skeleton } from '@/components/design-system/Feedback';

function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-on-surface text-lg font-semibold tracking-tight">{title}</h2>
      <Link
        href={href}
        className="text-on-surface-variant hover:text-on-surface inline-flex items-center gap-1 rounded-full border border-[color:var(--color-border-subtle)] px-3 py-1 text-xs font-medium transition-colors"
      >
        See all
        <ChevronRight size={14} />
      </Link>
    </div>
  );
}

function FeaturedShowsSkeleton() {
  return (
    <section className="space-y-3">
      <SectionHeader title="Watch real shows" href="/library" />
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div
            key={index}
            className="relative min-h-[14rem] overflow-hidden rounded-2xl bg-[color:var(--color-bg-elevated)] shadow-sm"
          >
            <Skeleton className="absolute inset-0 rounded-2xl" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.36)_0%,rgba(0,0,0,0.18)_48%,rgba(0,0,0,0.04)_100%)]" />
            <div className="relative flex min-h-[14rem] max-w-xl flex-col justify-end p-5 sm:p-6">
              <span className="mb-auto w-fit rounded-full border border-white/15 bg-white/14 px-2.5 py-1 text-[9px] font-semibold tracking-[0.12em] text-white/90 uppercase">
                {index === 0 ? 'Featured show' : 'Full replay'}
              </span>
              <Skeleton className="h-6 w-56 max-w-full" />
              <Skeleton className="mt-2 h-4 w-72 max-w-full" />
              <div className="mt-4 flex flex-wrap gap-4 text-white/78">
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 size={13} />
                  <Skeleton className="h-3 w-10 bg-white/25" />
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ListMusic size={13} />
                  <Skeleton className="h-3 w-6 bg-white/25" />
                </span>
              </div>
              <span className="mt-5 inline-flex h-10 w-fit items-center gap-2 rounded-full bg-white/16 px-4 text-sm font-medium text-white">
                Watch replay
                <Play size={14} />
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ExploreCardSkeleton({ index }: { index: number }) {
  return (
    <div className="w-44 shrink-0 sm:w-48" aria-hidden>
      <Skeleton className="aspect-[4/5] w-full rounded-xl" />
      <div className="mt-2.5 flex items-center gap-2">
        <Skeleton className="h-4 flex-1" />
        <Skeleton className="h-5 w-10 rounded-md" />
      </div>
      <Skeleton className={index % 2 === 0 ? 'mt-2 h-3 w-28' : 'mt-2 h-3 w-20'} />
      <div className="mt-2 flex items-center gap-3">
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-9" />
        <Skeleton className="h-3 w-9" />
      </div>
    </div>
  );
}

function ExploreSkeleton() {
  return (
    <section className="group/row relative">
      <div className="mb-3">
        <SectionHeader title="Explore" href="/library" />
      </div>
      <div className="relative">
        <div className="-mt-4 -mb-6 flex gap-4 overflow-hidden pt-4 pb-7">
          {Array.from({ length: 6 }).map((_, index) => (
            <ExploreCardSkeleton key={index} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function HomeSectionsSkeleton() {
  return (
    <div className="flex flex-col gap-7" aria-label="Loading home activity">
      <FeaturedShowsSkeleton />
      <HomeCollectionsSection />
      <ExploreSkeleton />
    </div>
  );
}

export function HomePageSkeleton() {
  return (
    <div
      className="mx-auto flex w-full max-w-[1400px] flex-col gap-7 pt-10 sm:pt-14 lg:pt-20"
      aria-label="Loading home"
    >
      <PromptHero headingLevel="h1" />
      <HomeSectionsSkeleton />
    </div>
  );
}
