/** Loading fallback for `/catalogue/[id]`. Without it the parent catalogue
 *  list skeleton would flash while a product resolves, so this mirrors the
 *  product page: back link, preview stage, then the summary and spec rows. */

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/ui/patterns/Feedback';

const SPEC_ROW_COUNT = 6;

export default function CatalogueProductLoading() {
  return (
    <div
      className="mx-auto flex w-full max-w-[1400px] flex-col gap-10"
      role="status"
      aria-busy="true"
      aria-label="Loading firework"
    >
      <Link
        href="/catalogue"
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-sm"
      >
        <ArrowLeft size={15} aria-hidden />
        Catalogue
      </Link>

      <section className="grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)] lg:gap-12">
        <div className="border-border bg-card h-fit overflow-hidden rounded-xl border shadow-xs">
          <Skeleton className="aspect-[16/10] w-full rounded-none" />
          <div className="px-4 py-2.5">
            <Skeleton className="h-3 w-40" />
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-4/5 sm:h-9" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>

          <div className="flex items-center gap-3">
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-3 w-28" />
          </div>

          <div className="border-border divide-border divide-y border-y">
            {Array.from({ length: SPEC_ROW_COUNT }).map((_, index) => (
              <div key={index} className="flex items-center justify-between gap-4 py-2.5">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-8 w-28" />
          </div>
        </div>
      </section>
    </div>
  );
}
