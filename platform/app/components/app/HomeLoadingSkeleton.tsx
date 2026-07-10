import { Skeleton } from '@/app/components/ui/Feedback';

function SeeAllSkeleton() {
  return <Skeleton className="h-7 w-20 rounded-full" />;
}

function SectionHeader({ title, action = false }: { title: string; action?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-on-surface text-lg font-semibold tracking-tight">{title}</h2>
      {action ? <SeeAllSkeleton /> : null}
    </div>
  );
}

function PromptHeroSkeleton() {
  return (
    <section className="relative isolate mx-auto w-full max-w-3xl py-10">
      <div className="prompt-hero-glow" aria-hidden />
      <h2 className="mb-6 text-center text-2xl font-semibold tracking-tight text-[color:var(--color-content-emphasis)] sm:text-3xl">
        Create any firework show you can imagine
      </h2>
      <div className="overflow-hidden rounded-2xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-elevated)]/55 shadow-xs backdrop-blur-md">
        <div className="h-28 p-4">
          <Skeleton className="h-4 w-full max-w-lg" />
          <Skeleton className="mt-3 h-4 w-2/3 max-w-md" />
        </div>
        <div className="bg-[linear-gradient(180deg,transparent_0%,color-mix(in_srgb,var(--color-bg-default)_24%,transparent)_100%)] px-4 pt-2 pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="ml-auto flex shrink-0 items-center gap-2.5">
              <Skeleton className="h-9 w-9 rounded-full" />
              <Skeleton className="h-9 w-[104px] rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeaturedShowsSkeleton() {
  return (
    <section className="space-y-3">
      <SectionHeader title="Watch real shows" action />
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div
            key={index}
            className="relative min-h-[14rem] overflow-hidden rounded-2xl bg-[color:var(--color-bg-elevated)] shadow-sm"
          >
            <Skeleton className="absolute inset-0 rounded-2xl" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.36)_0%,rgba(0,0,0,0.18)_48%,rgba(0,0,0,0.04)_100%)]" />
            <div className="relative flex min-h-[14rem] max-w-xl flex-col justify-end p-5 sm:p-6">
              <Skeleton className="mb-auto h-5 w-28 rounded-full" />
              <Skeleton className="h-6 w-56 max-w-full" />
              <Skeleton className="mt-2 h-4 w-72 max-w-full" />
              <div className="mt-4 flex flex-wrap gap-3">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="mt-5 h-10 w-32 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CollectionCardSkeleton({ index }: { index: number }) {
  return (
    <div
      className="w-[min(62vw,12rem)] shrink-0 snap-start p-1.5 sm:w-52 lg:w-auto lg:min-w-0"
      aria-hidden
    >
      <div className="relative pt-5">
        <Skeleton className="absolute top-0 right-8 left-8 z-0 aspect-square rounded-xl opacity-60" />
        <Skeleton className="absolute top-2.5 right-4 left-4 z-0 aspect-square rounded-xl opacity-80" />
        <Skeleton className="relative z-10 aspect-square w-full rounded-xl" />
      </div>
      <Skeleton className={index % 2 === 0 ? 'mt-2.5 h-4 w-32' : 'mt-2.5 h-4 w-24'} />
    </div>
  );
}

function CollectionsSkeleton() {
  return (
    <section className="space-y-4">
      <SectionHeader title="Curated collections" />
      <div className="relative -mx-4 sm:-mx-6 lg:mx-0">
        <div className="flex snap-x snap-mandatory scroll-px-4 gap-5 overflow-hidden px-4 pt-1 pb-4 sm:scroll-px-6 sm:gap-6 sm:px-6 lg:grid lg:grid-cols-5 lg:gap-[clamp(1.25rem,2.4vw,2.75rem)] lg:px-0 lg:pb-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <CollectionCardSkeleton key={index} index={index} />
          ))}
        </div>
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
        <SectionHeader title="Explore" action />
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
      <CollectionsSkeleton />
      <ExploreSkeleton />
    </div>
  );
}

export function HomePageSkeleton() {
  return (
    <div
      className="mx-auto flex w-full max-w-6xl flex-col gap-7 pt-10 sm:pt-14 lg:pt-20"
      aria-label="Loading home"
    >
      <PromptHeroSkeleton />
      <HomeSectionsSkeleton />
    </div>
  );
}
