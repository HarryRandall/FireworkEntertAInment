import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Heart, Sparkles, Wallet } from "lucide-react";
import Link from "next/link";
import { cloneShowTemplateAction } from "@/app/actions/show-templates";
import { TemplateLikeButton } from "@/app/components/app/TemplateLikeButton";
import { TemplateReplayPreview } from "@/app/components/app/TemplateReplayPreview";
import { Badge } from "@/app/components/ui/Badge";
import { Card } from "@/app/components/ui/Card";
import { formatBudget, formatDuration } from "@/lib/shows";
import { getShowTemplateBySlug } from "@/lib/platform.server";
import { listFireworkSpecifications } from "@/lib/shows.server";

type PageProps = { params: Promise<{ id: string }> };

export default async function LibraryDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [template, specifications] = await Promise.all([
    getShowTemplateBySlug(id),
    listFireworkSpecifications(),
  ]);
  if (!template) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/library"
        className="inline-flex items-center gap-2 text-sm font-bold text-primary"
      >
        <ArrowLeft size={16} />
        Back to show library
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <TemplateReplayPreview
          template={template}
          specifications={specifications}
          mode="detail"
        />

        <aside className="space-y-4">
          <Card elevation="high" radius="md" className="p-6">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
              {template.theme}
            </p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-on-surface">
              {template.title}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
              {template.description}
            </p>
            <div className="mt-5 space-y-3 text-sm text-on-surface-variant">
              <span className="flex items-center gap-2">
                <Heart size={16} />
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
            <div className="mt-5 flex flex-wrap gap-2">
              {template.moodTags.map((tag) => (
                <Badge key={tag} tone="neutral">
                  {tag}
                </Badge>
              ))}
            </div>
            <div className="mt-6 flex flex-col gap-3">
              <TemplateLikeButton
                templateSlug={template.slug}
                initialCount={template.likeCount}
              />
              <form action={cloneShowTemplateAction}>
                <input type="hidden" name="slug" value={template.slug} />
                <button className="h-12 w-full rounded-full bg-primary-container text-sm font-extrabold text-on-primary-container shadow-[var(--shadow-cta)] transition-all hover:brightness-110 active:scale-[0.98]">
                  Use this show
                </button>
              </form>
            </div>
          </Card>

          <Card elevation="low" radius="md" className="p-5">
            <h2 className="font-bold text-on-surface">Cue outline</h2>
            <ol className="mt-4 space-y-3">
              {template.previewCues.map((cue) => (
                <li key={`${cue.timeSeconds}-${cue.description}`} className="flex gap-3">
                  <span className="font-mono text-xs text-tertiary tabular-nums">
                    {formatDuration(cue.timeSeconds)}
                  </span>
                  <span className="text-sm text-on-surface-variant">
                    {cue.description}
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        </aside>
      </div>
    </div>
  );
}
