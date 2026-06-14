/** Show template detail page; lets the user clone a template into a new show. */

import { notFound } from 'next/navigation';
import { Clock, Heart, Sparkles, Wallet } from 'lucide-react';
import { Suspense } from 'react';
import { cloneShowTemplateAction } from '@/app/actions/show-templates';
import { AppPageHeader } from '@/app/components/app/AppPageHeader';
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
    <div className="space-y-6">
      <AppPageHeader title={template.title} description={template.description} />

      <div className="flex flex-col gap-3">
        <div className="text-on-surface-variant flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="flex items-center gap-2">
            <Heart size={16} className="fill-current text-[color:var(--destructive)]" />
            {template.likeCount} likes
          </span>
          <span className="flex items-center gap-2">
            <Clock size={16} />
            {formatDuration(template.durationSeconds)}
          </span>
          <span className="flex items-center gap-2">
            <Wallet size={16} />
            {formatBudget(template.totalCents)}
          </span>
          <span className="flex items-center gap-2">
            <Sparkles size={16} />
            {template.effectsCount} effects
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Suspense fallback={<ReplayPanelSkeleton />}>
          <LibraryDetailReplay template={template} />
        </Suspense>

        <aside className="space-y-4">
          <Card elevation="high" radius="md" className="p-6">
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
                <button className="bg-primary-container text-on-primary-container h-12 w-full rounded-full text-sm font-extrabold shadow-[var(--shadow-cta)] transition-all hover:brightness-110 active:scale-[0.98]">
                  Use this show
                </button>
              </form>
            </div>
          </Card>

          <Card elevation="low" radius="md" className="p-5">
            <h2 className="text-on-surface font-bold">Cue outline</h2>
            <ol className="mt-4 space-y-3">
              {template.previewCues.map((cue) => (
                <li key={`${cue.timeSeconds}-${cue.description}`} className="flex gap-3">
                  <span className="text-tertiary font-mono text-xs tabular-nums">
                    {formatDuration(cue.timeSeconds)}
                  </span>
                  <span className="text-on-surface-variant text-sm">{cue.description}</span>
                </li>
              ))}
            </ol>
          </Card>
        </aside>
      </div>
    </div>
  );
}

async function LibraryDetailReplay({ template }: { template: ShowTemplate }) {
  const specifications = await listFireworkSpecifications();
  return (
    <TemplateReplayPreview template={template} specifications={specifications} mode="detail" />
  );
}
