/** Show template detail page; lets the user clone a template into a new show. */

import { notFound } from 'next/navigation';
import { CalendarDays, Clock, Moon, RefreshCw, Sparkles, Wand2, Wallet } from 'lucide-react';
import { Suspense } from 'react';
import type * as React from 'react';
import { cloneShowTemplateAction } from '@/app/actions/show-templates';
import { ReplayPanelSkeleton } from '@/app/components/app/RouteSkeletons';
import { TemplateCurrentFireworkCard } from '@/app/components/app/TemplateCurrentFireworkCard';
import { TemplateLikeButton } from '@/app/components/app/TemplateLikeButton';
import { TemplateReplayPreview } from '@/app/components/app/TemplateReplayPreview';
import { Badge } from '@/app/components/ui/Badge';
import { Card } from '@/app/components/ui/Card';
import { Skeleton } from '@/app/components/ui/Feedback';
import { formatBudget, formatDuration, type FireworkSpecification } from '@/lib/show-domain';
import { getCurrentProfile, getShowTemplateBySlug } from '@/lib/admin.server';
import { listFireworkProducts } from '@/lib/shows.server';
import type { ShowTemplate } from '@/lib/admin.types';

type PageProps = { params: Promise<{ id: string }> };

export default async function LibraryDetailPage({ params }: PageProps) {
  const { id } = await params;
  const template = await getShowTemplateBySlug(id);
  if (!template) notFound();
  const specificationsPromise = listFireworkProducts();
  const currentProfilePromise = getCurrentProfile();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-on-surface text-2xl font-semibold tracking-tight md:text-3xl">
            {template.title}
          </h1>
          <p className="text-on-surface-variant mt-2 max-w-3xl text-sm leading-relaxed">
            {template.description ?? template.theme}
          </p>
        </div>
        <form action={cloneShowTemplateAction} className="w-full sm:w-fit">
          <input type="hidden" name="slug" value={template.slug} />
          <button className="bg-primary text-primary-foreground hover:bg-primary/90 focus-glow-action inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold shadow-[var(--shadow-cta)] transition-all active:scale-[0.98] sm:w-fit">
            <Wand2 size={16} />
            Use this show
          </button>
        </form>
      </header>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <Suspense fallback={<ReplayPanelSkeleton />}>
          <LibraryDetailReplay template={template} specificationsPromise={specificationsPromise} />
        </Suspense>

        <aside className="space-y-3 xl:sticky xl:top-20 xl:self-start">
          <Card elevation="high" radius="md" className="p-4">
            <p className="text-primary text-sm font-semibold">{template.theme}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {template.moodTags.map((tag) => (
                <Badge key={tag} tone="neutral">
                  {tag}
                </Badge>
              ))}
            </div>
            <div className="mt-4">
              <TemplateLikeButton templateSlug={template.slug} initialCount={template.likeCount} />
            </div>
          </Card>

          <Card elevation="low" radius="md" className="p-4">
            <h2 className="text-on-surface text-sm font-semibold">Show details</h2>
            <dl className="mt-3 space-y-2 text-[13px]">
              <DetailRow icon={<Clock size={14} />} label="Duration">
                {formatDuration(template.durationSeconds)}
              </DetailRow>
              <DetailRow icon={<Wallet size={14} />} label="Est. retail">
                {formatBudget(template.totalCents)}
              </DetailRow>
              <DetailRow icon={<Sparkles size={14} />} label="Effects">
                {template.effectsCount}
              </DetailRow>
              {template.timeOfDay ? (
                <DetailRow icon={<Moon size={14} />} label="Time of day">
                  {template.timeOfDay}
                </DetailRow>
              ) : null}
              <DetailRow icon={<CalendarDays size={14} />} label="Added">
                {formatDate(template.createdAt)}
              </DetailRow>
              {template.updatedAt && template.updatedAt !== template.createdAt ? (
                <DetailRow icon={<RefreshCw size={14} />} label="Updated">
                  {formatDate(template.updatedAt)}
                </DetailRow>
              ) : null}
            </dl>
          </Card>

          <Suspense fallback={<CurrentFireworkCardSkeleton />}>
            <LibraryDetailCurrentFirework
              template={template}
              specificationsPromise={specificationsPromise}
              currentProfilePromise={currentProfilePromise}
            />
          </Suspense>
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

async function LibraryDetailReplay({
  template,
  specificationsPromise,
}: {
  template: ShowTemplate;
  specificationsPromise: Promise<FireworkSpecification[]>;
}) {
  const specifications = await specificationsPromise;
  return (
    <TemplateReplayPreview template={template} specifications={specifications} mode="detail" />
  );
}

async function LibraryDetailCurrentFirework({
  template,
  specificationsPromise,
  currentProfilePromise,
}: {
  template: ShowTemplate;
  specificationsPromise: Promise<FireworkSpecification[]>;
  currentProfilePromise: ReturnType<typeof getCurrentProfile>;
}) {
  const [specifications, currentProfile] = await Promise.all([
    specificationsPromise,
    currentProfilePromise,
  ]);
  const canEditFireworks = currentProfile?.permissions.includes('admin.manage_catalogue') ?? false;
  return (
    <TemplateCurrentFireworkCard
      templateSlug={template.slug}
      previewCues={template.previewCues}
      specifications={specifications}
      canEditFireworks={canEditFireworks}
    />
  );
}

function CurrentFireworkCardSkeleton() {
  return (
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
  );
}
