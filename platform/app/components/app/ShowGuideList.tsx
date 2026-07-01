/**
 * ShowGuideList — step-by-step firing guide rendered on the show
 * detail route inside the `/app` group. Pure presentation; the
 * upstream server component flattens multi-shot products into cues.
 */
import { Card } from '@/app/components/ui/Card';
import { EmptyNotice } from '@/app/components/ui/Feedback';
import { SectionHeader } from '@/app/components/ui/SectionHeader';
import type { ShowCue } from '@/lib/show-domain';

type ShowGuideListProps = {
  steps: ShowCue[];
};

function formatCueTime(seconds: number | null): string {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${m}:${s}`;
}

export function ShowGuideList({ steps }: ShowGuideListProps) {
  return (
    <Card elevation="low" radius="md" className="space-y-6 p-8">
      <SectionHeader
        title="Show Guide"
        description="Step-by-step firing instructions, timestamped to your song."
      />

      {steps.length === 0 ? (
        <EmptyNotice>
          No cues yet. They&apos;ll appear here once the AI has choreographed your show.
        </EmptyNotice>
      ) : (
        <ol className="space-y-0">
          {steps.map((step, i) => {
            const isLast = i === steps.length - 1;
            return (
              <li key={step.id} className="flex gap-6">
                <div className="flex flex-col items-center">
                  <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-mono text-sm font-bold tabular-nums">
                    {formatCueTime(step.timeSeconds)}
                  </div>
                  {!isLast ? <div className="bg-outline-variant/20 mt-2 w-0.5 flex-grow" /> : null}
                </div>
                <p className="text-on-surface pb-8 leading-relaxed">{step.description}</p>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
