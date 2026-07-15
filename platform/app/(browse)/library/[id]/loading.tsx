/** Loading skeleton for a library template detail page.
 *
 *  Without this, the async detail page suspends against `library/loading.tsx`
 *  and the library card grid flashes when opening a template. This mirrors the
 *  detail layout: header, the replay panel, and the info aside. */

import { CalendarDays, Clock, Heart, Moon, RefreshCw, Sparkles, Wand2, Wallet } from 'lucide-react';
import { TemplateReplaySkeleton } from '@/app/components/app/RouteSkeletons';
import { Card } from '@/app/components/ui/Card';
import { Skeleton } from '@/app/components/ui/Feedback';

const DETAIL_ROWS = [
  { label: 'Duration', icon: Clock, valueWidth: 'w-12' },
  { label: 'Est. retail', icon: Wallet, valueWidth: 'w-16' },
  { label: 'Effects', icon: Sparkles, valueWidth: 'w-8' },
  { label: 'Time of day', icon: Moon, valueWidth: 'w-12' },
  { label: 'Added', icon: CalendarDays, valueWidth: 'w-20' },
  { label: 'Updated', icon: RefreshCw, valueWidth: 'w-20' },
] as const;

export default function LibraryDetailLoading() {
  return (
    <div
      className="mx-auto flex w-full max-w-[1600px] flex-col gap-5"
      aria-label="Loading template"
    >
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-9 w-72 max-w-full" />
          <Skeleton className="h-5 w-96 max-w-full" />
        </div>
        <button
          type="button"
          disabled
          className="bg-primary text-primary-foreground inline-flex h-11 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold opacity-70 sm:w-fit"
        >
          <Wand2 size={16} />
          Use this show
        </button>
      </header>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <TemplateReplaySkeleton />

        <aside className="space-y-3">
          <Card elevation="high" radius="md" className="p-4">
            <Skeleton className="h-5 w-40" aria-label="Loading show theme" />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-6 w-16 rounded-full" />
              ))}
            </div>
            <button
              type="button"
              disabled
              className="border-border/70 bg-background/70 text-on-surface-variant mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-full border px-4 text-sm font-bold"
              aria-label="Loading saved show count"
            >
              <Heart size={16} className="text-destructive" />
              <Skeleton className="h-4 w-8" />
            </button>
          </Card>

          <Card elevation="low" radius="md" className="p-4">
            <h2 className="text-on-surface text-sm font-semibold">Show details</h2>
            <div className="mt-3 space-y-2">
              {DETAIL_ROWS.map(({ label, icon: Icon, valueWidth }) => (
                <div key={label} className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="text-on-surface-variant flex items-center gap-2">
                    <Icon size={14} className="text-on-surface-variant/70" />
                    {label}
                  </span>
                  <Skeleton className={`h-4 ${valueWidth}`} />
                </div>
              ))}
            </div>
          </Card>

          <Card elevation="low" radius="md" className="p-4">
            <h2 className="text-on-surface text-sm font-semibold">Current firework</h2>
            <div className="mt-3 space-y-4">
              <div className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-3">
                <div className="relative flex justify-center">
                  <span className="bg-muted absolute top-0 bottom-1/2 w-px" />
                  <span className="bg-muted absolute top-1/2 -bottom-4 w-px" />
                  <span className="bg-muted border-card absolute top-1.5 h-2.5 w-2.5 rounded-full border-2" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-4 w-10" />
                  </div>
                  <Skeleton className="mt-2 h-3 w-32" />
                </div>
              </div>
              <div className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-3">
                <div className="relative flex justify-center">
                  <span className="bg-muted absolute top-0 bottom-1/2 w-px" />
                  <span className="bg-muted border-card absolute top-1.5 h-2 w-2 rounded-full border-2" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-3 w-9" />
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
