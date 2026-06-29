/** Loading skeleton shared by marketing routes. */

import { Container } from '@/app/components/ui/Container';
import { Skeleton } from '@/app/components/ui/Feedback';

export default function MarketingLoading() {
  return (
    <section
      className="bg-background relative isolate min-h-[calc(100vh-4rem)] overflow-hidden pt-28 pb-20 lg:pt-36 lg:pb-28"
      aria-label="Loading page"
    >
      <Container className="relative z-10 flex flex-col items-center text-center">
        <Skeleton className="h-8 w-80 max-w-full rounded-full bg-[color:var(--color-bg-emphasis)]" />
        <div className="mt-8 flex w-full max-w-5xl flex-col items-center gap-4">
          <Skeleton className="h-14 w-full max-w-4xl bg-[color:var(--color-bg-emphasis)] md:h-20" />
          <Skeleton className="h-14 w-4/5 max-w-3xl bg-[color:var(--color-bg-emphasis)] md:h-20" />
        </div>
        <div className="mt-8 flex w-full max-w-2xl flex-col items-center gap-3">
          <Skeleton className="h-5 w-full bg-[color:var(--color-bg-emphasis)]" />
          <Skeleton className="h-5 w-4/5 bg-[color:var(--color-bg-emphasis)]" />
        </div>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Skeleton className="h-12 w-40 rounded-lg bg-[color:var(--color-bg-emphasis)]" />
          <Skeleton className="h-12 w-44 rounded-lg bg-[color:var(--color-bg-emphasis)]" />
        </div>
      </Container>
    </section>
  );
}
