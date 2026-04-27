import { Card } from "@/app/components/ui/Card";

export type ShowGuideStep = {
  time: string;
  description: string;
};

type ShowGuideListProps = {
  steps: ShowGuideStep[];
};

export function ShowGuideList({ steps }: ShowGuideListProps) {
  return (
    <Card elevation="low" radius="md" className="space-y-6 p-8">
      <header className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-on-surface">
          Show Guide
        </h2>
        <p className="text-sm text-on-surface-variant">
          Step-by-step firing instructions, timestamped to your song.
        </p>
      </header>

      <ol className="space-y-0">
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1;
          return (
            <li key={`${step.time}-${i}`} className="flex gap-6">
              <div className="flex flex-col items-center">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-sm font-bold tabular-nums text-primary">
                  {step.time}
                </div>
                {!isLast ? (
                  <div className="mt-2 w-0.5 flex-grow bg-outline-variant/20" />
                ) : null}
              </div>
              <p className="pb-8 leading-relaxed text-on-surface">
                {step.description}
              </p>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
