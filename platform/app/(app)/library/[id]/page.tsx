/** Show template detail page; lets the user clone a template into a new show. */

import { notFound } from 'next/navigation';
import {
  CalendarDays,
  Clock,
  ListMusic,
  Moon,
  RefreshCw,
  Sparkles,
  Wand2,
  Wallet,
} from 'lucide-react';
import { Suspense } from 'react';
import type * as React from 'react';
import { cloneShowTemplateAction } from '@/app/actions/show-templates';
import { ReplayPanelSkeleton } from '@/app/components/app/RouteSkeletons';
import { TemplateLikeButton } from '@/app/components/app/TemplateLikeButton';
import { TemplateReplayPreview } from '@/app/components/app/TemplateReplayPreview';
import { Badge } from '@/app/components/ui/Badge';
import { Card } from '@/app/components/ui/Card';
import { formatBudget, formatDuration } from '@/lib/show-domain';
import { getShowTemplateBySlug } from '@/lib/admin.server';
import { listFireworkSpecifications } from '@/lib/shows.server';
import type { ShowTemplate } from '@/lib/admin.types';

type PageProps = { params: Promise<{ id: string }> };

export default async function LibraryDetailPage({ params }: PageProps) {
  const { id } = await params;
  const template = await getShowTemplateBySlug(id);
  if (!template) notFound();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="text-primary mb-2 inline-flex items-center gap-2 text-xs font-semibold tracking-[0.16em] uppercase">
            <Sparkles size={14} />
            Library replay
          </div>
          <h1 className="text-on-surface text-2xl font-semibold tracking-tight md:text-3xl">
            {template.title}
          </h1>
          <p className="text-on-surface-variant mt-2 max-w-3xl text-sm leading-relaxed">
            {template.description ?? template.theme}
          </p>
        </div>
        <form action={cloneShowTemplateAction} className="w-full sm:w-fit">
          <input type="hidden" name="slug" value={template.slug} />
          <button className="bg-primary text-primary-foreground hover:bg-primary/90 focus-glow-action inline-flex h-11 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold shadow-[var(--shadow-cta)] transition-all active:scale-[0.98] sm:w-fit">
            <Wand2 size={16} />
            Use this show
          </button>
        </form>
      </header>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Suspense fallback={<ReplayPanelSkeleton />}>
          <LibraryDetailReplay template={template} />
        </Suspense>

        <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <Card elevation="high" radius="md" className="p-5">
            <p className="text-primary text-sm font-semibold">{template.theme}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {template.moodTags.map((tag) => (
                <Badge key={tag} tone="neutral">
                  {tag}
                </Badge>
              ))}
            </div>
            <div className="mt-6 flex flex-col gap-3">
              <TemplateLikeButton templateSlug={template.slug} initialCount={template.likeCount} />
              <form action={cloneShowTemplateAction}>
                <input type="hidden" name="slug" value={template.slug} />
                <button className="bg-primary-container text-on-primary-container h-11 w-full rounded-full text-sm font-semibold shadow-[var(--shadow-cta)] transition-all hover:brightness-110 active:scale-[0.98]">
                  Use this show
                </button>
              </form>
            </div>
          </Card>

          <Card elevation="low" radius="md" className="p-5">
            <h2 className="text-on-surface text-sm font-semibold">Show details</h2>
            <dl className="mt-4 space-y-2.5 text-sm">
              <DetailRow icon={<Clock size={15} />} label="Duration">
                {formatDuration(template.durationSeconds)}
              </DetailRow>
              <DetailRow icon={<Wallet size={15} />} label="Cost">
                {formatBudget(template.totalCents)}
              </DetailRow>
              <DetailRow icon={<Sparkles size={15} />} label="Effects">
                {template.effectsCount}
              </DetailRow>
              <DetailRow icon={<ListMusic size={15} />} label="Cues">
                {template.previewCues.length}
              </DetailRow>
              {template.timeOfDay ? (
                <DetailRow icon={<Moon size={15} />} label="Time of day">
                  {template.timeOfDay}
                </DetailRow>
              ) : null}
              <DetailRow icon={<CalendarDays size={15} />} label="Added">
                {formatDate(template.createdAt)}
              </DetailRow>
              {template.updatedAt && template.updatedAt !== template.createdAt ? (
                <DetailRow icon={<RefreshCw size={15} />} label="Updated">
                  {formatDate(template.updatedAt)}
                </DetailRow>
              ) : null}
            </dl>
          </Card>

          <Card elevation="low" radius="md" className="p-5">
            <h2 className="text-on-surface text-sm font-semibold">Cue schedule</h2>
            <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
              {template.previewCues.map((cue, index) => (
                <div
                  key={`${cue.fireworkSlug}-${cue.timeSeconds}-${index}`}
                  className="border-outline-variant/35 bg-surface-container-low grid grid-cols-[3.75rem_minmax(0,1fr)] gap-3 rounded-lg border px-3 py-2 text-sm"
                >
                  <span className="text-on-surface-variant font-mono text-xs tabular-nums">
                    {formatDuration(cue.timeSeconds)}
                  </span>
                  <span className="min-w-0">
                    <span className="text-on-surface block truncate font-medium">
                      {cue.description || cue.fireworkSlug}
                    </span>
                    <span className="text-on-surface-variant block truncate text-xs">
                      {cue.fireworkSlug}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-on-surface-variant flex items-center gap-2">
        <span className="text-on-surface-variant/70">{icon}</span>
        {label}
      </dt>
      <dd className="text-on-surface font-medium">{children}</dd>
    </div>
  );
}

function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

async function LibraryDetailReplay({ template }: { template: ShowTemplate }) {
  const specifications = await listFireworkSpecifications();
  return (
    <TemplateReplayPreview template={template} specifications={specifications} mode="detail" />
  );
}
