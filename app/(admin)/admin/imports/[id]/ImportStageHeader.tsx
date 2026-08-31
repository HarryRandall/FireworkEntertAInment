import { Check, Circle } from 'lucide-react';
import { Badge } from '@/app/components/ui/Badge';
import {
  IMPORT_REVIEW_STEPS,
  importStageIndex,
  importStageLabel,
  importStatusTone,
} from '@/lib/import-review';

export function ImportStageHeader({
  sourceName,
  status,
  stage,
  modelConfidence,
}: {
  sourceName: string;
  status: string;
  stage: string | null;
  modelConfidence: number | null;
}) {
  const activeIndex = importStageIndex(status, stage);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Video reconstruction
          </p>
          <h1 className="text-foreground mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            {sourceName}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Compare source evidence, renderer output and deterministic validation before publish.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Badge solid tone={importStatusTone(status)}>
            {importStageLabel(status, stage)}
          </Badge>
          {modelConfidence != null ? (
            <Badge tone="neutral" className="font-mono tabular-nums">
              Model confidence {Math.round(modelConfidence * 100)}%
            </Badge>
          ) : null}
        </div>
      </div>

      <nav aria-label="Import progress" className="overflow-x-auto pb-1">
        <ol className="grid min-w-[660px] grid-cols-6">
          {IMPORT_REVIEW_STEPS.map((label, index) => {
            const complete = index < activeIndex || status === 'complete';
            const current = index === activeIndex && status !== 'complete';
            return (
              <li
                key={label}
                className="relative flex flex-col items-center gap-2 px-1 text-center"
                aria-current={current ? 'step' : undefined}
              >
                {index > 0 ? (
                  <span
                    aria-hidden="true"
                    className={`absolute top-3 right-1/2 h-px w-full ${index <= activeIndex ? 'bg-primary' : 'bg-border'}`}
                  />
                ) : null}
                <span
                  className={`relative z-10 grid size-6 place-items-center rounded-full border ${
                    complete
                      ? 'border-primary bg-primary text-primary-foreground'
                      : current
                        ? 'border-primary bg-background text-primary ring-primary/20 ring-4'
                        : 'border-border bg-background text-muted-foreground'
                  }`}
                >
                  {complete ? (
                    <Check size={13} strokeWidth={3} aria-hidden="true" />
                  ) : (
                    <Circle size={8} fill="currentColor" aria-hidden="true" />
                  )}
                </span>
                <span
                  className={`text-xs ${current ? 'text-foreground font-medium' : 'text-muted-foreground'}`}
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
