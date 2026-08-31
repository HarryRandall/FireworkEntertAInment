'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/design-system/Card';
import {
  buildTemplateReplayCues,
  TEMPLATE_REPLAY_ACTIVE_CUE_EVENT,
  type TemplateReplayActiveCueEventDetail,
} from '@/components/explore/template-replay-cues';
import type { ShowTemplateCue } from '@/lib/admin.types';
import { formatDuration, type FireworkSpecification, type ReplayCue } from '@/lib/show-domain';

type TemplateCurrentFireworkCardProps = {
  templateSlug: string;
  previewCues: ShowTemplateCue[];
  specifications: FireworkSpecification[];
  canEditFireworks?: boolean;
};

export function TemplateCurrentFireworkCard({
  templateSlug,
  previewCues,
  specifications,
  canEditFireworks = false,
}: TemplateCurrentFireworkCardProps) {
  const cues = useMemo(
    () => buildTemplateReplayCues(previewCues, specifications),
    [previewCues, specifications],
  );
  const fallbackCueId = cues[0]?.id ?? null;
  const [activeCueId, setActiveCueId] = useState<string | null>(fallbackCueId);

  useEffect(() => {
    setActiveCueId(fallbackCueId);
  }, [fallbackCueId]);

  useEffect(() => {
    function handleActiveCue(event: Event) {
      const detail = (event as CustomEvent<TemplateReplayActiveCueEventDetail>).detail;
      if (!detail || detail.templateSlug !== templateSlug) return;
      setActiveCueId(detail.cueId ?? fallbackCueId);
    }

    window.addEventListener(TEMPLATE_REPLAY_ACTIVE_CUE_EVENT, handleActiveCue);
    return () => window.removeEventListener(TEMPLATE_REPLAY_ACTIVE_CUE_EVENT, handleActiveCue);
  }, [fallbackCueId, templateSlug]);

  const activeCue = cues.find((cue) => cue.id === activeCueId) ?? cues[0] ?? null;
  const activeCueIndex = activeCue ? cues.findIndex((cue) => cue.id === activeCue.id) : -1;
  const nextCue = activeCueIndex >= 0 ? (cues[activeCueIndex + 1] ?? null) : null;

  return (
    <Card elevation="low" radius="md" className="p-4">
      <h2 className="text-on-surface text-sm font-semibold">Current firework</h2>

      {activeCue ? (
        <div className="mt-3 space-y-4">
          <TimelineCue
            cue={activeCue}
            tone="current"
            isLast={!nextCue}
            canEditFireworks={canEditFireworks}
          />
          {nextCue ? (
            <TimelineCue cue={nextCue} tone="next" isLast canEditFireworks={canEditFireworks} />
          ) : null}
        </div>
      ) : (
        <p className="text-muted-foreground mt-3 text-xs">No firework cue is ready.</p>
      )}
    </Card>
  );
}

function TimelineCue({
  cue,
  tone,
  isLast,
  canEditFireworks,
}: {
  cue: ReplayCue;
  tone: 'current' | 'next';
  isLast: boolean;
  canEditFireworks: boolean;
}) {
  const description = cue.description || cue.firework.description;
  const isCurrent = tone === 'current';
  const nameClassName = isCurrent
    ? 'text-on-surface block min-w-0 text-sm leading-snug font-semibold'
    : 'text-muted-foreground block min-w-0 text-xs leading-snug font-medium';
  const linkedNameClassName = `${nameClassName} rounded-sm underline-offset-4 transition-colors hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card`;
  const fireworkAdminId = cue.firework.variant?.id ?? cue.firework.id;

  return (
    <div className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-3">
      <div className="relative flex justify-center" aria-hidden>
        <span
          className={
            isCurrent
              ? 'bg-primary absolute top-0 bottom-1/2 w-px'
              : 'bg-border absolute top-0 bottom-1/2 w-px'
          }
        />
        {!isLast ? <span className="bg-border absolute top-1/2 -bottom-4 w-px" /> : null}
        <span
          className={
            isCurrent
              ? 'bg-primary border-card absolute top-1.5 h-2.5 w-2.5 rounded-full border-2'
              : 'bg-muted-foreground/50 border-card absolute top-1.5 h-2 w-2 rounded-full border-2'
          }
        />
      </div>
      <div className="min-w-0">
        <div className="flex min-w-0 items-start justify-between gap-3">
          {canEditFireworks ? (
            <Link
              href={`/admin/fireworks/${fireworkAdminId}`}
              prefetch={false}
              className={linkedNameClassName}
              aria-label={`Edit ${cue.firework.name}`}
            >
              {cue.firework.name}
            </Link>
          ) : (
            <p className={nameClassName}>{cue.firework.name}</p>
          )}
          <span className="text-muted-foreground shrink-0 font-mono text-[11px] tabular-nums">
            {formatDuration(cue.timeSeconds)}
          </span>
        </div>
        {description ? (
          <p
            className={
              isCurrent
                ? 'text-on-surface-variant mt-1 line-clamp-2 text-xs leading-relaxed'
                : 'text-muted-foreground/80 mt-1 line-clamp-1 text-[11px] leading-relaxed'
            }
          >
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}
