/**
 * ShowGuideList is the cue-by-cue plan rendered on the show
 * detail route inside the `/app` group. Pure presentation; the
 * upstream server component flattens multi-shot products into cues.
 */
import { formatCueTime } from './show-display';
import { Card } from '@/ui/patterns/Card';
import { EmptyNotice } from '@/ui/patterns/Feedback';
import { SectionHeader } from '@/ui/patterns/SectionHeader';
import type { ShowCue } from '@/lib/show-domain';

type ShowGuideListProps = {
  steps: ShowCue[];
};

/** Render a compact operator guide without restricting the shared page width. */
export function ShowGuideList({ steps }: ShowGuideListProps) {
  return (
    <Card radius="md" className="space-y-4 p-4">
      <SectionHeader
        title="Show Guide"
        description="A cue-by-cue plan, timestamped to your song for review with your operator."
      />

      {steps.length === 0 ? (
        <EmptyNotice>
          No cues yet. They&apos;ll appear here once show generation finishes.
        </EmptyNotice>
      ) : (
        <ol className="space-y-0">
          {steps.map((step, i) => {
            const isLast = i === steps.length - 1;
            return (
              <li key={step.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="bg-primary/10 text-primary flex h-8 min-w-16 shrink-0 items-center justify-center rounded-md px-2 text-sm font-bold tabular-nums">
                    {formatCueTime(step.timeSeconds)}
                  </div>
                  {!isLast ? <div className="bg-border mt-2 w-0.5 flex-grow" /> : null}
                </div>
                <p className="text-foreground min-w-0 pb-4 text-sm leading-relaxed break-words">
                  {step.description}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
